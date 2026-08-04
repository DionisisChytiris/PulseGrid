import type { TimingTick } from '../../domain/timing/TimingTick';

/** Quick Metronome Practice Trainer settings (Phase 1: in-memory only). */
export type TempoTrainerSettings = {
  readonly enabled: boolean;
  /** Increase tempo after this many completed bars. */
  readonly barsInterval: number;
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
  readonly enabled: boolean;
};

export const DEFAULT_TEMPO_TRAINER_SETTINGS: TempoTrainerSettings = {
  enabled: false,
  barsInterval: 4,
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
};

/**
 * Quick Metronome Practice Trainer.
 *
 * Owns completed-bar counting and tempo-increase decisions.
 * Never talks to native code, the scheduler, or Song Timeline.
 * BPM changes only via the injected setBpm callback (PlaybackService.setBpm).
 *
 * Experiment: queue BPM at end-of-bar; let the next downbeat play at the old
 * tempo; apply the queued BPM once immediately after that beat 1 is received.
 */
export class TempoTrainerService {
  private settings: TempoTrainerSettings = { ...DEFAULT_TEMPO_TRAINER_SETTINGS };
  private completedBars = 0;
  private seenFirstDownbeat = false;
  private pendingBpm: number | null = null;
  /** TEMP debug — previous TimingTick.timestamp for interval measurement. */
  private previousTickTimestampMs: number | null = null;
  private readonly listeners = new Set<() => void>();
  private cachedStatus: TempoTrainerStatus = {
    completedBars: 0,
    barsTowardNext: 0,
    barsInterval: DEFAULT_TEMPO_TRAINER_SETTINGS.barsInterval,
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
    this.settings = normalizeSettings(next);

    if (!this.settings.enabled) {
      this.pendingBpm = null;
      this.notify();
      return;
    }

    if (!wasEnabled && this.settings.enabled) {
      this.resetCounter();
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
    // TEMP debug — interval measurement before any trainer BPM logic
    const previousTimestamp = this.previousTickTimestampMs;
    const deltaMsSincePreviousTick =
      previousTimestamp === null ? null : tick.timestamp - previousTimestamp;
    this.previousTickTimestampMs = tick.timestamp;
    console.log('[TempoInterval]', {
      sequence: tick.sequence,
      beatNumber: tick.beatNumber,
      subdivisionIndex: tick.subdivisionIndex,
      bpm: this.deps.getBpm(),
      deltaMsSincePreviousTick,
      timestamp: tick.timestamp,
    });

    if (!this.settings.enabled) {
      return;
    }

    const beatsPerMeasure = Math.max(1, Math.floor(this.deps.getBeatsPerMeasure()));
    const ticksPerBeat = Math.max(1, Math.floor(this.deps.getTicksPerBeat()));

    // First downbeat of the run — start of bar 1, do not complete a bar / apply.
    if (tick.beatNumber === 1 && tick.subdivisionIndex === 0 && !this.seenFirstDownbeat) {
      this.seenFirstDownbeat = true;
      this.notify();
      return;
    }

    if (!this.seenFirstDownbeat) {
      return;
    }

    // Experiment: after next downbeat has been published/received, apply once.
    if (
      tick.beatNumber === 1 &&
      tick.subdivisionIndex === 0 &&
      this.pendingBpm !== null
    ) {
      this.applyPendingBpm(tick);
    }

    if (!isFinalTickOfBar(tick, beatsPerMeasure, ticksPerBeat)) {
      this.notify();
      return;
    }

    // End of a bar that was already started → one completed bar.
    this.completedBars += 1;

    const { barsInterval, bpmDelta, maxBpm } = this.settings;
    if (barsInterval > 0 && this.completedBars % barsInterval === 0) {
      const current = this.deps.getBpm();
      if (current < maxBpm) {
        const next = Math.min(current + bpmDelta, maxBpm);
        if (next !== current) {
          this.pendingBpm = next;
          console.log('[TempoTrainer] pending bpm', {
            pendingBpm: next,
            beatNumber: tick.beatNumber,
            subdivisionIndex: tick.subdivisionIndex,
            sequence: tick.sequence,
          });
        }
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

    const next = this.pendingBpm;
    this.pendingBpm = null;

    console.log('[TempoTrainer] applying bpm', {
      bpm: next,
      beatNumber: tick.beatNumber,
      subdivisionIndex: tick.subdivisionIndex,
      sequence: tick.sequence,
    });

    this.deps.setBpm(next);
  }

  private resetCounter(): void {
    this.completedBars = 0;
    this.seenFirstDownbeat = false;
    this.pendingBpm = null;
    this.previousTickTimestampMs = null;
  }

  private refreshStatus(): void {
    const barsInterval = this.settings.barsInterval;
    this.cachedStatus = {
      completedBars: this.completedBars,
      barsTowardNext: barsInterval > 0 ? this.completedBars % barsInterval : 0,
      barsInterval,
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
  return {
    enabled: settings.enabled,
    barsInterval: Math.max(1, Math.floor(settings.barsInterval)),
    bpmDelta: Math.max(1, Math.floor(settings.bpmDelta)),
    maxBpm: Math.max(1, Math.floor(settings.maxBpm)),
  };
}
