import type { TimeSignature } from '../entities/Metronome';
import { AccentPattern } from '../valueObjects/AccentPattern';
import { Subdivision } from '../valueObjects/Subdivision';
import { BeatClock, msPerBeat } from './BeatClock';
import type { Tick } from './Tick';
import { TempoMap, type TempoState } from './TempoMap';

export type SchedulerStatus = 'idle' | 'running' | 'stopped';

export type SchedulerConfig = {
  tempo: TempoState;
  timeSignature: TimeSignature;
  accentPattern?: AccentPattern;
  subdivision?: Subdivision;
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

/**
 * Builds abstract tick schedules from tempo and meter.
 * Does not execute or schedule against real time.
 */
export class Scheduler {
  private status: SchedulerStatus = 'idle';
  private clock: BeatClock;
  private timeSignature: TimeSignature;
  private accentPattern: AccentPattern;
  private subdivision: Subdivision;

  constructor(config: SchedulerConfig) {
    this.clock = new BeatClock(config.tempo);
    this.timeSignature = { ...config.timeSignature };
    this.accentPattern =
      config.accentPattern ??
      AccentPattern.downbeatOnly(config.timeSignature.numerator);
    this.subdivision = config.subdivision ?? Subdivision.quarter();
  }

  getStatus(): SchedulerStatus {
    return this.status;
  }

  getClock(): BeatClock {
    return this.clock;
  }

  getTimeSignature(): TimeSignature {
    return { ...this.timeSignature };
  }

  setTempo(tempo: TempoState): void {
    this.clock.setTempo(tempo);
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    assertPositiveInteger(timeSignature.numerator, 'Time signature numerator');
    assertPositiveInteger(timeSignature.denominator, 'Time signature denominator');
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

  getAccentPattern(): AccentPattern {
    return this.accentPattern;
  }

  setSubdivision(subdivision: Subdivision): void {
    this.subdivision = subdivision;
  }

  getSubdivision(): Subdivision {
    return this.subdivision;
  }

  start(): void {
    this.status = 'running';
  }

  stop(): void {
    this.status = 'stopped';
  }

  reset(): void {
    this.status = 'idle';
  }

  /**
   * Returns true when the beat is accented according to the current pattern.
   */
  isAccentBeat(beatIndex: number, subdivisionIndex = 0): boolean {
    assertNonNegativeInteger(beatIndex, 'Beat index');
    assertNonNegativeInteger(subdivisionIndex, 'Subdivision index');

    if (!this.subdivision.isPrimaryBeat(subdivisionIndex)) {
      return false;
    }

    return this.accentPattern.isAccent(beatIndex);
  }

  private createTick(
    beatIndex: number,
    subdivisionIndex: number,
    timestamp: number,
  ): Tick {
    return {
      beatIndex,
      subdivisionIndex,
      isAccent: this.isAccentBeat(beatIndex, subdivisionIndex),
      timestamp,
    };
  }

  /**
   * Produces a sequence of logical tick events without using real timers.
   */
  generateTicks(fromBeat: number, beatCount: number, startTimestampMs = 0): Tick[] {
    assertNonNegativeInteger(fromBeat, 'From beat');
    assertPositiveInteger(beatCount, 'Beat count');

    if (startTimestampMs < 0) {
      throw new RangeError('Start timestamp cannot be negative');
    }

    const ticksPerBeat = this.subdivision.getTicksPerBeat();
    const totalTicks = beatCount * ticksPerBeat;
    const ticks: Tick[] = [];
    const beatFraction = this.subdivision.getBeatFraction();

    for (let offset = 0; offset < totalTicks; offset += 1) {
      const beatIndex = fromBeat + Math.floor(offset / ticksPerBeat);
      const subdivisionIndex = offset % ticksPerBeat;
      const timestamp = startTimestampMs + this.clock.beatsToMs(offset * beatFraction);

      ticks.push(this.createTick(beatIndex, subdivisionIndex, timestamp));
    }

    return ticks;
  }

  /**
   * Produces ticks for one complete bar.
   */
  generateBarTicks(barIndex: number, startTimestampMs = 0): Tick[] {
    assertNonNegativeInteger(barIndex, 'Bar index');

    const fromBeat = barIndex * this.timeSignature.numerator;
    return this.generateTicks(fromBeat, this.timeSignature.numerator, startTimestampMs);
  }

  /**
   * Builds a schedule across multiple bars using a tempo map.
   * Each map segment applies from its start beat onward (constant tempo within a segment).
   */
  generateTicksWithTempoMap(
    tempoMap: TempoMap,
    fromBeat: number,
    beatCount: number,
    startTimestampMs = 0,
  ): Tick[] {
    assertNonNegativeInteger(fromBeat, 'From beat');
    assertPositiveInteger(beatCount, 'Beat count');

    const ticks: Tick[] = [];
    let timestamp = startTimestampMs;
    const beatFraction = this.subdivision.getBeatFraction();

    for (let offset = 0; offset < beatCount; offset += 1) {
      const beatIndex = fromBeat + offset;
      const bpm = tempoMap.getBpmAtBeat(beatIndex);
      const ticksPerBeat = this.subdivision.getTicksPerBeat();

      for (let subdivisionIndex = 0; subdivisionIndex < ticksPerBeat; subdivisionIndex += 1) {
        ticks.push(this.createTick(beatIndex, subdivisionIndex, timestamp));
        timestamp += msPerBeat(bpm) * beatFraction;
      }
    }

    return ticks;
  }
}
