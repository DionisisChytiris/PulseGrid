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
 * Uses setInterval for simulation only — not for audio scheduling.
 */
export class RuntimeScheduler {
  private readonly onTick: (tick: Tick) => void;
  private clock: BeatClock;
  private timeSignature: TimeSignature;
  private accentPattern: AccentPattern;
  private subdivision: Subdivision;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tickIndex = 0;
  private logicalTimestampMs = 0;
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

    this.emitCurrentTick();
    this.restartInterval();
  }

  stop(): void {
    this.clearInterval();
    this.running = false;
  }

  private restartInterval(): void {
    this.clearInterval();

    const beatMs = this.clock.beatsToMs(1);
    const intervalMs = beatMs * this.subdivision.getBeatFraction();
    this.intervalId = setInterval(() => this.advanceTick(), intervalMs);
  }

  private advanceTick(): void {
    const beatMs = this.clock.beatsToMs(1);
    const intervalMs = beatMs * this.subdivision.getBeatFraction();
    this.tickIndex += 1;
    this.logicalTimestampMs += intervalMs;
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

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
