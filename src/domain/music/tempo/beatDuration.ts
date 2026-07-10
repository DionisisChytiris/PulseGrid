import { BeatUnit } from '../BeatUnit';
import type { TempoDefinition } from '../TempoDefinition';

const NS_PER_MINUTE = 60_000_000_000;

const SUPPORTED_BEAT_UNITS = new Set<BeatUnit>([
  BeatUnit.WHOLE,
  BeatUnit.HALF,
  BeatUnit.QUARTER,
  BeatUnit.EIGHTH,
  BeatUnit.SIXTEENTH,
  BeatUnit.THIRTY_SECOND,
  BeatUnit.DOTTED_HALF,
  BeatUnit.DOTTED_QUARTER,
  BeatUnit.DOTTED_EIGHTH,
]);

/** Whole-note fraction represented by one beat unit. */
export function beatUnitWholeNoteFraction(beatUnit: BeatUnit): number {
  switch (beatUnit) {
    case BeatUnit.WHOLE:
      return 1;
    case BeatUnit.HALF:
      return 1 / 2;
    case BeatUnit.QUARTER:
      return 1 / 4;
    case BeatUnit.EIGHTH:
      return 1 / 8;
    case BeatUnit.SIXTEENTH:
      return 1 / 16;
    case BeatUnit.THIRTY_SECOND:
      return 1 / 32;
    case BeatUnit.DOTTED_HALF:
      return 3 / 4;
    case BeatUnit.DOTTED_QUARTER:
      return 3 / 8;
    case BeatUnit.DOTTED_EIGHTH:
      return 3 / 16;
    default:
      throw new RangeError(`Unsupported beat unit: ${String(beatUnit)}`);
  }
}

/**
 * Nanosecond duration of one [beatUnit] note at [tempoDefinition.bpm].
 * BPM is interpreted as quarter notes per minute (standard tempo marking).
 */
export function computeBeatDurationNs(tempoDefinition: TempoDefinition): number {
  const { bpm, beatUnit } = tempoDefinition;

  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('TempoDefinition bpm must be a positive finite number');
  }

  if (!SUPPORTED_BEAT_UNITS.has(beatUnit)) {
    throw new RangeError(`Unsupported beat unit: ${String(beatUnit)}`);
  }

  const quarterNoteDurationNs = NS_PER_MINUTE / bpm;
  const beatUnitFraction = beatUnitWholeNoteFraction(beatUnit);
  const quarterFraction = beatUnitWholeNoteFraction(BeatUnit.QUARTER);

  return Math.max(
    1,
    Math.floor((quarterNoteDurationNs * beatUnitFraction) / quarterFraction),
  );
}

/**
 * Duration of one timeline pulse / click at [tempoDefinition.bpm].
 * Uses [pulseBeatUnit] for spacing — never reads Meter.denominator.
 */
export function computePulseDurationNs(
  tempoDefinition: TempoDefinition,
  pulseBeatUnit: BeatUnit,
): number {
  if (!SUPPORTED_BEAT_UNITS.has(pulseBeatUnit)) {
    throw new RangeError(`Unsupported pulse beat unit: ${String(pulseBeatUnit)}`);
  }

  return computeBeatDurationNs({
    bpm: tempoDefinition.bpm,
    beatUnit: pulseBeatUnit,
  });
}

/** Cumulative score offsets from precomputed per-event pulse durations. */
export function computeTimelineDeadlineOffsetsNs(
  beatDurationsNs: readonly number[],
): readonly number[] {
  const offsets = new Array<number>(beatDurationsNs.length + 1);
  let offsetNs = 0;

  for (let index = 0; index < beatDurationsNs.length; index += 1) {
    offsets[index] = offsetNs;
    offsetNs += beatDurationsNs[index] ?? 0;
  }

  offsets[beatDurationsNs.length] = offsetNs;
  return offsets;
}
