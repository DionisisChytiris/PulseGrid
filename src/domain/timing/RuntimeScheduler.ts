import type { TimeSignature } from '../entities/Metronome';
import { AccentPattern } from '../valueObjects/AccentPattern';
import { Subdivision } from '../valueObjects/Subdivision';
import { BeatClock } from './BeatClock';
import type { Tick } from './Tick';
import type { TempoState } from './TempoMap';

export type RuntimeSchedulerConfig = {
  clock: BeatClock;
  timeSignature: TimeSignature;
  accentPattern?: AccentPattern;
  subdivision?: Subdivision;
  onTick: (tick: Tick) => void;
};

/**
 * Simulation runtime that emits ticks on a beat interval derived from BeatClock.
 * Uses wall-clock aligned timeouts for simulation — not for audio scheduling.
 */
export class RuntimeScheduler {
  private readonly onTick: (tick: Tick) => void;
  private clock: BeatClock;
  private timeSignature: TimeSignature;
  private accentPattern: AccentPattern;
  private subdivision: Subdivision;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private tickIndex = 0;
  private logicalTimestampMs = 0;
  /** Wall time (ms) when tick 0 was emitted; re-anchored on tempo/subdivision changes. */
  private startWallMs = 0;
  private running = false;

  constructor(config: RuntimeSchedulerConfig) {
    this.clock = config.clock;
    this.timeSignature = { ...config.timeSignature };
    this.accentPattern =
      config.accentPattern ??
      AccentPattern.downbeatOnly(config.timeSignature.numerator);
    this.subdivision = config.subdivision ?? Subdivision.quarter();
    this.onTick = config.onTick;
  }

  isRunning(): boolean {
    return this.running;
  }

  getClock(): BeatClock {
    return this.clock;
  }

  getSubdivision(): Subdivision {
    return this.subdivision;
  }

  setTempo(tempo: TempoState): void {
    this.clock.setTempo(tempo);

    if (this.running) {
      this.restartInterval();
    }
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this.timeSignature = { ...timeSignature };
    this.accentPattern = AccentPattern.downbeatOnly(timeSignature.numerator);
  }

  setAccentPattern(accentPattern: AccentPattern): void {
    if (accentPattern.getBeatsPerMeasure() !== this.timeSignature.numerator) {
      throw new RangeError(
        'Accent pattern length must match the current time signature numerator',
      );
    }

    this.accentPattern = accentPattern;
  }

  setSubdivision(subdivision: Subdivision): void {
    this.subdivision = subdivision;

    if (this.running) {
      this.restartInterval();
    }
  }

  getAccentPattern(): AccentPattern {
    return this.accentPattern;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.tickIndex = 0;
    this.logicalTimestampMs = 0;
    this.startWallMs = Date.now();

    this.emitCurrentTick();
    this.scheduleNextTick();
  }

  stop(): void {
    this.clearTimer();
    this.running = false;
  }

  private getIntervalMs(): number {
    const beatMs = this.clock.beatsToMs(1);
    return beatMs * this.subdivision.getBeatFraction();
  }

  /** Re-anchor wall clock and reschedule without resetting beat position. */
  private restartInterval(): void {
    if (!this.running) {
      return;
    }

    const intervalMs = this.getIntervalMs();
    this.startWallMs = Date.now() - this.tickIndex * intervalMs;
    this.scheduleNextTick();
  }

  private scheduleNextTick(): void {
    this.clearTimer();

    if (!this.running) {
      return;
    }

    const intervalMs = this.getIntervalMs();
    const nextTickWallMs = this.startWallMs + (this.tickIndex + 1) * intervalMs;
    const delay = Math.max(0, nextTickWallMs - Date.now());

    this.timeoutId = setTimeout(() => {
      if (!this.running) {
        return;
      }

      this.catchUpTicks();
      this.scheduleNextTick();
    }, delay);
  }

  /** Emit any ticks whose scheduled wall time has already passed. */
  private catchUpTicks(): void {
    const intervalMs = this.getIntervalMs();

    while (this.running) {
      const nextTickWallMs = this.startWallMs + (this.tickIndex + 1) * intervalMs;
      if (Date.now() < nextTickWallMs) {
        break;
      }

      this.advanceTick();
    }
  }

  private advanceTick(): void {
    const intervalMs = this.getIntervalMs();
    this.tickIndex += 1;
    this.logicalTimestampMs = this.tickIndex * intervalMs;
    this.emitCurrentTick();
  }

  private emitCurrentTick(): void {
    const { beatIndex, subdivisionIndex } = this.subdivision.splitBeatIndex(this.tickIndex);
    const isAccent =
      this.subdivision.isPrimaryBeat(subdivisionIndex) &&
      this.accentPattern.isAccent(beatIndex);

    const tick: Tick = {
      beatIndex,
      subdivisionIndex,
      isAccent,
      timestamp: this.logicalTimestampMs,
    };

    const beatInBar = (beatIndex % this.timeSignature.numerator) + 1;
    const accentLabel = tick.isAccent ? ' (accent)' : '';
    const subLabel =
      this.subdivision.getTicksPerBeat() > 1
        ? ` sub ${subdivisionIndex + 1}`
        : '';
    console.log(`TICK beat ${beatInBar}${subLabel}${accentLabel}`);

    this.onTick(tick);
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
