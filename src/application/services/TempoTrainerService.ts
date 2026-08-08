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
  /**
   * Bars remaining until the next bar-mode increase is queued
   * (`barsInterval` when on a boundary, otherwise `barsInterval - barsTowardNext`).
   */
  readonly barsUntilNextIncrease: number;
  readonly barsInterval: number;
  readonly increaseMode: TempoIncreaseMode;
  readonly timeIntervalSeconds: number;
  /** BPM added on each scheduled increase (mirrors settings for UI status). */
  readonly bpmDelta: number;
  /** Elapsed training seconds since clock origin, or null before origin. */
  readonly elapsedTrainingSeconds: number | null;
  /**
   * Seconds until the next time-based increase is due, or null when the
   * monotonic schedule is not armed. Derived from [nextIncreaseAtMs].
   */
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
  /**
   * Display-only: completedBars advances on the final tick of a bar (for scheduling),
   * but barsUntilNextIncrease / barsTowardNext lag until the following beat 1 so the
   * UI countdown changes at the bar boundary — not one beat early.
   */
  private barsDisplayLagging = false;
  /** Monotonic ms origin for TIME mode; set on first downbeat / enable while playing. */
  private trainingOriginMs: number | null = null;
  /** Next TIME-mode increase threshold (monotonic ms). */
  private nextIncreaseAtMs: number | null = null;
  private readonly listeners = new Set<() => void>();
  private cachedStatus: TempoTrainerStatus = {
    completedBars: 0,
    barsTowardNext: 0,
    barsUntilNextIncrease: DEFAULT_TEMPO_TRAINER_SETTINGS.barsInterval,
    barsInterval: DEFAULT_TEMPO_TRAINER_SETTINGS.barsInterval,
    increaseMode: DEFAULT_TEMPO_TRAINER_SETTINGS.increaseMode,
    timeIntervalSeconds: DEFAULT_TEMPO_TRAINER_SETTINGS.timeIntervalSeconds,
    bpmDelta: DEFAULT_TEMPO_TRAINER_SETTINGS.bpmDelta,
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
    // Also commit the deferred bar countdown so UI advances at the bar boundary.
    if (tick.beatNumber === 1 && tick.subdivisionIndex === 0) {
      this.barsDisplayLagging = false;
      if (this.pendingBpm !== null) {
        this.applyPendingBpm(tick);
      }
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
    // Defer status countdown until the next beat 1 (display only).
    this.barsDisplayLagging = true;

    if (this.settings.increaseMode === 'bars') {
      const { barsInterval } = this.settings;
      if (barsInterval > 0 && this.completedBars % barsInterval === 0) {
        this.queuePendingIncrease('bars', tick);
      }
    }

    this.notify();
  }

  getStatus(): TempoTrainerStatus {
    // Always derive the live TIME countdown from the trainer deadline so UI
    // polls stay synchronized without a second timer.
    if (this.settings.enabled && this.settings.increaseMode === 'time') {
      return {
        ...this.cachedStatus,
        secondsUntilNextIncrease: this.computeSecondsUntilNextIncrease(),
      };
    }
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

    // TIME mode: start the next countdown from the musical apply point, not from
    // the earlier wall-clock deadline (keeps UI at 0 while pending).
    if (this.settings.increaseMode === 'time') {
      this.rearmTimeScheduleFromNow();
    }
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
    if (now < this.nextIncreaseAtMs) {
      return;
    }

    if (this.deps.getBpm() >= this.settings.maxBpm) {
      // Stay parked at the deadline so status remains 0 at the ceiling.
      return;
    }
    if (this.pendingBpm !== null) {
      // Wait for beat-boundary apply; leave deadline in the past so status stays 0.
      return;
    }

    this.queuePendingIncrease('time', tick);
    // Do NOT advance nextIncreaseAtMs here — the next cycle starts when BPM is
    // applied on the musical boundary (see applyPendingBpm).
  }

  private computeSecondsUntilNextIncrease(now: number = this.nowMs()): number | null {
    if (this.settings.increaseMode !== 'time') {
      return null;
    }
    if (this.nextIncreaseAtMs === null) {
      return null;
    }
    // Time deadline reached / pending musical apply → hold at 0.
    if (this.pendingBpm !== null) {
      return 0;
    }
    return Math.max(0, (this.nextIncreaseAtMs - now) / 1000);
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
    this.barsDisplayLagging = false;
    this.trainingOriginMs = null;
    this.nextIncreaseAtMs = null;
  }

  private refreshStatus(): void {
    const barsInterval = this.settings.barsInterval;
    // Scheduling uses completedBars immediately; UI countdown lags one beat.
    const barsForDisplay = this.barsDisplayLagging
      ? Math.max(0, this.completedBars - 1)
      : this.completedBars;
    const barsTowardNext = barsInterval > 0 ? barsForDisplay % barsInterval : 0;
    const barsUntilNextIncrease =
      barsInterval <= 0
        ? 0
        : barsTowardNext === 0
          ? barsInterval
          : barsInterval - barsTowardNext;
    const now = this.nowMs();
    const elapsedTrainingSeconds =
      this.trainingOriginMs === null ? null : (now - this.trainingOriginMs) / 1000;
    const secondsUntilNextIncrease = this.computeSecondsUntilNextIncrease(now);

    this.cachedStatus = {
      completedBars: this.completedBars,
      barsTowardNext,
      barsUntilNextIncrease,
      barsInterval,
      increaseMode: this.settings.increaseMode,
      timeIntervalSeconds: this.settings.timeIntervalSeconds,
      bpmDelta: this.settings.bpmDelta,
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
