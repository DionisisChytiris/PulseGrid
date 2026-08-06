import type { TimingTick } from '../../domain/timing/TimingTick';

/** How Practice Trainer decides when to queue the next BPM increase. */
export type TempoIncreaseMode = 'bars' | 'time';

/** Quick Metronome Practice Trainer settings (Phase 1: in-memory only). */
export type TempoTrainerSettings = {
  readonly enabled: boolean;
  /** Bar-count vs wall-clock (monotonic) increase scheduling. */
  readonly increaseMode: TempoIncreaseMode;
  /** Increase tempo after this many completed bars (mode = bars). */
  readonly barsInterval: number;
  /** Seconds between increases (mode = time), measured with a monotonic clock. */
  readonly timeIntervalSeconds: number;
  /** BPM added on each increase. */
  readonly bpmDelta: number;
  /** Hard ceiling; at/above this value no further increases. */
  readonly maxBpm: number;
};

export type TempoTrainerStatus = {
  readonly completedBars: number;
  /** Progress toward the next increase (`completedBars % barsInterval`). */
  readonly barsTowardNext: number;
  readonly barsInterval: number;
  readonly increaseMode: TempoIncreaseMode;
  readonly timeIntervalSeconds: number;
  /** Elapsed training seconds since clock origin, or null before origin. */
  readonly elapsedTrainingSeconds: number | null;
  /** Seconds until the next time-based increase is due, or null. */
  readonly secondsUntilNextIncrease: number | null;
  readonly enabled: boolean;
};

export const DEFAULT_TEMPO_TRAINER_SETTINGS: TempoTrainerSettings = {
  enabled: false,
  increaseMode: 'time',
  barsInterval: 2,
  timeIntervalSeconds: 10,
  bpmDelta: 2,
  maxBpm: 200,
};

export type TempoTrainerDeps = {
  /** Always route tempo changes through PlaybackService.setBpm. */
  readonly setBpm: (bpm: number) => void;
  readonly getBpm: () => number;
  /** Quick Metronome meter numerator (beats per bar). */
  readonly getBeatsPerMeasure: () => number;
  /** Quick Metronome subdivision pulse count per beat. */
  readonly getTicksPerBeat: () => number;
  /**
   * Optional monotonic clock in milliseconds (defaults to performance.now).
   * Tests may inject a controllable clock. Do not use Date.now.
   */
  readonly nowMs?: () => number;
};

/**
 * Quick Metronome Practice Trainer.
 *
 * Owns completed-bar / elapsed-time counting and tempo-increase decisions.
 * Never talks to native code, the scheduler, or Song Timeline.
 * BPM changes only via the injected setBpm callback (PlaybackService.setBpm).
 *
 * Increases are queued as pendingBpm and applied on a beat boundary via
 * applyPendingBpm (after the following bar's beat 1 has been received).
 */
export class TempoTrainerService {
  private settings: TempoTrainerSettings = { ...DEFAULT_TEMPO_TRAINER_SETTINGS };
  private completedBars = 0;
  private seenFirstDownbeat = false;
  private pendingBpm: number | null = null;
  /** Monotonic ms origin for TIME mode; set on first downbeat / enable while playing. */
  private trainingOriginMs: number | null = null;
  /** Next TIME-mode increase threshold (monotonic ms). */
  private nextIncreaseAtMs: number | null = null;
  /** TEMP debug — previous TimingTick.timestamp for interval measurement. */
  private previousTickTimestampMs: number | null = null;
  /** TEMP debug — BPM at last TempoInterval sample; detects live retune between ticks. */
  private previousIntervalBpm: number | null = null;
  /** TEMP debug — emit intervalBaselineReset on the first sample after applyPendingBpm. */
  private intervalBaselineResetPending = false;
  private readonly listeners = new Set<() => void>();
  private cachedStatus: TempoTrainerStatus = {
    completedBars: 0,
    barsTowardNext: 0,
    barsInterval: DEFAULT_TEMPO_TRAINER_SETTINGS.barsInterval,
    increaseMode: DEFAULT_TEMPO_TRAINER_SETTINGS.increaseMode,
    timeIntervalSeconds: DEFAULT_TEMPO_TRAINER_SETTINGS.timeIntervalSeconds,
    elapsedTrainingSeconds: null,
    secondsUntilNextIncrease: null,
    enabled: DEFAULT_TEMPO_TRAINER_SETTINGS.enabled,
  };

  constructor(private readonly deps: TempoTrainerDeps) {}

  getSettings(): TempoTrainerSettings {
    return this.settings;
  }

  /**
   * Replace trainer settings from Quick Metronome UI.
   * Enable OFF → stop counting. Enable transitioning to ON → reset counter.
   */
  setSettings(next: TempoTrainerSettings): void {
    const wasEnabled = this.settings.enabled;
    const previousMode = this.settings.increaseMode;
    this.settings = normalizeSettings(next);

    if (!this.settings.enabled) {
      this.pendingBpm = null;
      this.trainingOriginMs = null;
      this.nextIncreaseAtMs = null;
      this.notify();
      return;
    }

    if (!wasEnabled && this.settings.enabled) {
      this.resetCounter();
    } else if (
      wasEnabled &&
      previousMode !== this.settings.increaseMode &&
      this.settings.increaseMode === 'time'
    ) {
      // Switching into TIME mid-session: start a fresh monotonic window.
      this.rearmTimeScheduleFromNow();
    }

    this.notify();
  }

  /** Playback started (Quick Metronome) → reset completed-bar counter. */
  onPlaybackStarted(): void {
    this.resetCounter();
    this.notify();
  }

  /** Playback stopped (Quick Metronome) → reset completed-bar counter. */
  onPlaybackStopped(): void {
    this.resetCounter();
    this.notify();
  }

  /**
   * Consume a Quick Metronome timing tick.
   * Counts completions on the final tick of a bar; applies queued BPM once
   * after the following bar's beat 1 has been emitted to this handler.
   */
  onTick(tick: TimingTick): void {
    // TEMP debug — interval measurement before any trainer BPM logic.
    // TimingTick.timestamp is musical position under the native anchor, so a live
    // retune jumps the timeline; never subtract across that boundary.
    const bpm = this.deps.getBpm();
    const previousTimestamp = this.previousTickTimestampMs;
    const pendingBaselineReset = this.intervalBaselineResetPending;
    if (pendingBaselineReset) {
      this.intervalBaselineResetPending = false;
    }
    const timelineRetuned =
      this.previousIntervalBpm !== null && this.previousIntervalBpm !== bpm;
    const rawDeltaMs =
      previousTimestamp === null || pendingBaselineReset || timelineRetuned
        ? null
        : tick.timestamp - previousTimestamp;
    const negativeDelta = rawDeltaMs !== null && rawDeltaMs < 0;
    const intervalBaselineReset = pendingBaselineReset || timelineRetuned || negativeDelta;
    const deltaMsSincePreviousTick = intervalBaselineReset ? null : rawDeltaMs;
    this.previousTickTimestampMs = tick.timestamp;
    this.previousIntervalBpm = bpm;
    console.log('[TempoInterval]', {
      sequence: tick.sequence,
      beatNumber: tick.beatNumber,
      subdivisionIndex: tick.subdivisionIndex,
      bpm,
      deltaMsSincePreviousTick,
      timestamp: tick.timestamp,
      ...(intervalBaselineReset ? { intervalBaselineReset: true } : {}),
    });

    if (!this.settings.enabled) {
      return;
    }

    const beatsPerMeasure = Math.max(1, Math.floor(this.deps.getBeatsPerMeasure()));
    const ticksPerBeat = Math.max(1, Math.floor(this.deps.getTicksPerBeat()));

    // First downbeat of the run — start of bar 1, do not complete a bar / apply.
    if (tick.beatNumber === 1 && tick.subdivisionIndex === 0 && !this.seenFirstDownbeat) {
      this.seenFirstDownbeat = true;
      this.ensureTimeScheduleArmed();
      this.notify();
      return;
    }

    if (!this.seenFirstDownbeat) {
      return;
    }

    // Apply queued BPM once the next downbeat has been published/received.
    if (
      tick.beatNumber === 1 &&
      tick.subdivisionIndex === 0 &&
      this.pendingBpm !== null
    ) {
      this.applyPendingBpm(tick);
    }

    if (this.settings.increaseMode === 'time') {
      this.ensureTimeScheduleArmed();
      this.maybeQueueTimeBasedIncrease(tick);
    }

    if (!isFinalTickOfBar(tick, beatsPerMeasure, ticksPerBeat)) {
      this.notify();
      return;
    }

    // End of a bar that was already started → one completed bar.
    this.completedBars += 1;

    if (this.settings.increaseMode === 'bars') {
      const { barsInterval } = this.settings;
      if (barsInterval > 0 && this.completedBars % barsInterval === 0) {
        this.queuePendingIncrease('bars', tick);
      }
    }

    this.notify();
  }

  getStatus(): TempoTrainerStatus {
    return this.cachedStatus;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private applyPendingBpm(tick: TimingTick): void {
    if (this.pendingBpm === null) {
      return;
    }

    const oldBpm = this.deps.getBpm();
    const next = this.pendingBpm;
    this.pendingBpm = null;

    const now = this.nowMs();
    const elapsedTrainingSeconds =
      this.trainingOriginMs === null ? null : (now - this.trainingOriginMs) / 1000;
    const secondsUntilNextIncrease =
      this.nextIncreaseAtMs === null ? null : Math.max(0, (this.nextIncreaseAtMs - now) / 1000);

    console.log('[TempoTrainer] applying bpm', {
      mode: this.settings.increaseMode,
      elapsedTrainingSeconds,
      nextIncreaseAtMs: this.nextIncreaseAtMs,
      secondsUntilNextIncrease,
      oldBpm,
      newBpm: next,
      beatNumber: tick.beatNumber,
      subdivisionIndex: tick.subdivisionIndex,
      sequence: tick.sequence,
    });

    this.deps.setBpm(next);
    // Native retune moves TimingTick.timestamp's origin; drop the pre-retune baseline
    // so the next TempoInterval sample does not subtract across timelines.
    this.previousTickTimestampMs = null;
    this.previousIntervalBpm = next;
    this.intervalBaselineResetPending = true;
  }

  private queuePendingIncrease(reason: 'bars' | 'time', tick: TimingTick): void {
    if (this.pendingBpm !== null) {
      return;
    }

    const oldBpm = this.deps.getBpm();
    const { bpmDelta, maxBpm, increaseMode } = this.settings;
    if (oldBpm >= maxBpm) {
      return;
    }

    const next = Math.min(oldBpm + bpmDelta, maxBpm);
    if (next === oldBpm) {
      return;
    }

    this.pendingBpm = next;

    const now = this.nowMs();
    const elapsedTrainingSeconds =
      this.trainingOriginMs === null ? null : (now - this.trainingOriginMs) / 1000;
    const secondsUntilNextIncrease =
      this.nextIncreaseAtMs === null ? null : Math.max(0, (this.nextIncreaseAtMs - now) / 1000);

    console.log('[TempoTrainer] pending bpm', {
      mode: increaseMode,
      reason,
      elapsedTrainingSeconds,
      nextIncreaseAtMs: this.nextIncreaseAtMs,
      secondsUntilNextIncrease,
      oldBpm,
      newBpm: next,
      beatNumber: tick.beatNumber,
      subdivisionIndex: tick.subdivisionIndex,
      sequence: tick.sequence,
    });
  }

  private maybeQueueTimeBasedIncrease(tick: TimingTick): void {
    if (this.settings.increaseMode !== 'time') {
      return;
    }
    if (this.nextIncreaseAtMs === null) {
      return;
    }

    const intervalMs = this.settings.timeIntervalSeconds * 1000;
    if (intervalMs <= 0) {
      return;
    }

    const now = this.nowMs();
    while (now >= this.nextIncreaseAtMs) {
      if (this.deps.getBpm() >= this.settings.maxBpm) {
        // Stay parked at the next slot so status remains stable at the ceiling.
        break;
      }
      if (this.pendingBpm !== null) {
        // Wait for beat-boundary apply before queuing another increase.
        break;
      }

      this.queuePendingIncrease('time', tick);
      this.nextIncreaseAtMs += intervalMs;

      // Only one pending increase at a time.
      if (this.pendingBpm !== null) {
        break;
      }

      // Could not queue (already at ceiling) — avoid infinite loop.
      break;
    }
  }

  private ensureTimeScheduleArmed(): void {
    if (this.settings.increaseMode !== 'time') {
      return;
    }
    if (this.trainingOriginMs !== null && this.nextIncreaseAtMs !== null) {
      return;
    }
    this.rearmTimeScheduleFromNow();
  }

  private rearmTimeScheduleFromNow(): void {
    const now = this.nowMs();
    this.trainingOriginMs = now;
    this.nextIncreaseAtMs = now + this.settings.timeIntervalSeconds * 1000;
  }

  private nowMs(): number {
    if (this.deps.nowMs) {
      return this.deps.nowMs();
    }
    return monotonicNowMs();
  }

  private resetCounter(): void {
    this.completedBars = 0;
    this.seenFirstDownbeat = false;
    this.pendingBpm = null;
    this.trainingOriginMs = null;
    this.nextIncreaseAtMs = null;
    this.previousTickTimestampMs = null;
    this.previousIntervalBpm = null;
    this.intervalBaselineResetPending = false;
  }

  private refreshStatus(): void {
    const barsInterval = this.settings.barsInterval;
    const now = this.nowMs();
    const elapsedTrainingSeconds =
      this.trainingOriginMs === null ? null : (now - this.trainingOriginMs) / 1000;
    const secondsUntilNextIncrease =
      this.settings.increaseMode === 'time' && this.nextIncreaseAtMs !== null
        ? Math.max(0, (this.nextIncreaseAtMs - now) / 1000)
        : null;

    this.cachedStatus = {
      completedBars: this.completedBars,
      barsTowardNext: barsInterval > 0 ? this.completedBars % barsInterval : 0,
      barsInterval,
      increaseMode: this.settings.increaseMode,
      timeIntervalSeconds: this.settings.timeIntervalSeconds,
      elapsedTrainingSeconds,
      secondsUntilNextIncrease,
      enabled: this.settings.enabled,
    };
  }

  private notify(): void {
    this.refreshStatus();
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function isFinalTickOfBar(
  tick: TimingTick,
  beatsPerMeasure: number,
  ticksPerBeat: number,
): boolean {
  return tick.beatNumber === beatsPerMeasure && tick.subdivisionIndex === ticksPerBeat - 1;
}

function normalizeSettings(settings: TempoTrainerSettings): TempoTrainerSettings {
  const increaseMode: TempoIncreaseMode = settings.increaseMode === 'time' ? 'time' : 'bars';
  return {
    enabled: settings.enabled,
    increaseMode,
    barsInterval: Math.max(1, Math.floor(settings.barsInterval)),
    timeIntervalSeconds: Math.max(1, Math.floor(settings.timeIntervalSeconds)),
    bpmDelta: Math.max(1, Math.floor(settings.bpmDelta)),
    maxBpm: Math.max(1, Math.floor(settings.maxBpm)),
  };
}

/** Monotonic clock; never Date.now(). */
function monotonicNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  // React Native / Hermes always provide performance.now; keep a hard fail as safeguard.
  throw new Error('TempoTrainerService requires a monotonic clock (performance.now)');
}
