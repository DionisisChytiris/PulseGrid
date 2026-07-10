import { BeatUnit } from './BeatUnit';

/** Time signature for a single bar (e.g. 7/8, 4/4, 13/16). */
export interface Meter {
  readonly numerator: number;
  /** Notation only — must not be read by playback timing code. */
  readonly denominator: number;
  /** Beat groups within the bar; must sum to [numerator]. */
  readonly grouping: readonly number[];
}

/** Validates that beat groups sum to the bar's numerator. */
export function validateMeterGrouping(numerator: number, grouping: readonly number[]): void {
  if (grouping.length === 0) {
    throw new RangeError('Meter grouping must not be empty');
  }

  let sum = 0;

  for (const size of grouping) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError('Each meter group size must be a positive integer');
    }

    sum += size;
  }

  if (sum !== numerator) {
    throw new RangeError(
      `Meter grouping must sum to numerator (got ${sum}, expected ${numerator})`,
    );
  }
}

/** Default asymmetric grouping for common compound meters. */
export function defaultMeterGrouping(numerator: number, denominator: number): readonly number[] {
  if (denominator === 8) {
    if (numerator === 4) {
      return [2, 2];
    }

    if (numerator === 7) {
      return [3, 2, 2];
    }

    if (numerator === 6) {
      return [3, 3];
    }

    if (numerator === 9) {
      return [3, 3, 3];
    }

    if (numerator === 12) {
      return [3, 3, 3, 3];
    }
  }

  if (denominator === 2 && numerator > 2 && numerator % 2 === 0) {
    return Array.from({ length: numerator / 2 }, () => 2);
  }

  return [numerator];
}

export function createMeter(
  numerator: number,
  denominator: number,
  grouping?: readonly number[],
): Meter {
  if (!Number.isInteger(numerator) || numerator <= 0) {
    throw new RangeError('Meter numerator must be a positive integer');
  }

  if (!Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError('Meter denominator must be a positive integer');
  }

  const resolvedGrouping = grouping ?? defaultMeterGrouping(numerator, denominator);
  validateMeterGrouping(numerator, resolvedGrouping);

  return {
    numerator,
    denominator,
    grouping: [...resolvedGrouping],
  };
}

export function formatMeter(meter: Meter): string {
  return `${meter.numerator}/${meter.denominator}`;
}

function groupingsEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((size, index) => size === b[index]);
}

export function metersEqual(a: Meter, b: Meter): boolean {
  return (
    a.numerator === b.numerator &&
    a.denominator === b.denominator &&
    groupingsEqual(a.grouping, b.grouping)
  );
}

export function cloneMeter(meter: Meter): Meter {
  return createMeter(meter.numerator, meter.denominator, meter.grouping);
}

/** Infer beat unit from denominator alone (PulseGrid default tempo reference). */
export function inferBeatUnitFromDenominator(denominator: number): BeatUnit {
  switch (denominator) {
    case 2:
      return BeatUnit.HALF;
    case 4:
      return BeatUnit.QUARTER;
    case 8:
      return BeatUnit.EIGHTH;
    case 16:
      return BeatUnit.SIXTEENTH;
    case 32:
      return BeatUnit.THIRTY_SECOND;
    default:
      return BeatUnit.QUARTER;
  }
}

/**
 * Default tempo beat unit — inferred from denominator only (denominator-driven defaults).
 */
export function inferTempoBeatUnitFromMeter(meter: Meter): BeatUnit {
  return inferBeatUnitFromDenominator(meter.denominator);
}

/**
 * Beat unit for one numerator pulse / click spacing in the compiled timeline.
 */
export function inferPulseBeatUnitFromMeter(meter: Meter): BeatUnit {
  return inferBeatUnitFromDenominator(meter.denominator);
}

/** @deprecated Use inferTempoBeatUnitFromMeter */
export const inferBeatUnitFromMeter = inferTempoBeatUnitFromMeter;
