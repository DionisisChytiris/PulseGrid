import type { TimeSignature } from '../entities/Metronome';
import { beatUnitWholeNoteFraction } from '../music/tempo/beatDuration';
import { BeatUnit } from '../music/BeatUnit';
import { createMeter, inferBeatUnitFromDenominator } from '../music/Meter';
import type { SubdivisionKind } from '../valueObjects/Subdivision';
import {
  DEFAULT_SUBDIVISION_ACCENT_MODE,
  type SubdivisionAccentMode,
} from './SubdivisionAccentMode';

const QUARTER_FRACTION = beatUnitWholeNoteFraction(BeatUnit.QUARTER);

const SUBDIVISION_NOTE_FRACTION: Record<SubdivisionKind, number> = {
  quarter: 1 / 4,
  eighth: 1 / 8,
  triplet: 1 / 12,
  sixteenth: 1 / 16,
};

const TICKS_PER_SUBDIVISION_KIND: Record<SubdivisionKind, number> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
};

export type FinerSubdivisionSelection = SubdivisionKind | null;

export type PulseGridEngineConfig = {
  readonly engineBpm: number;
  readonly beatsPerMeasure: number;
  readonly accentPattern: readonly boolean[];
  readonly subdivision: SubdivisionKind;
  /** Subdivision accent behavior; beat accents use accentPattern only. */
  readonly subdivisionAccentMode: SubdivisionAccentMode;
};

export type SubdivisionAvailability = {
  readonly finerSubdivisions: readonly SubdivisionKind[];
  readonly disabledReason: string | null;
};

function pulseFractionForDenominator(denominator: number): number {
  return beatUnitWholeNoteFraction(inferBeatUnitFromDenominator(denominator));
}

/** Display BPM shown in the UI from the engine-facing BPM value. */
export function toDisplayBpm(engineBpm: number, denominator: number): number {
  const pulseFraction = pulseFractionForDenominator(denominator);
  return engineBpm * (pulseFraction / QUARTER_FRACTION);
}

/** Engine BPM required to realize [displayBpm] at the meter denominator pulse grid. */
export function toEngineBpm(displayBpm: number, denominator: number): number {
  const pulseFraction = pulseFractionForDenominator(denominator);
  return displayBpm * (QUARTER_FRACTION / pulseFraction);
}

/** Finer subdivisions available for a denominator; excludes the base pulse resolution. */
export function getSubdivisionAvailability(denominator: number): SubdivisionAvailability {
  const baseFraction = pulseFractionForDenominator(denominator);
  const finerSubdivisions = (Object.keys(SUBDIVISION_NOTE_FRACTION) as SubdivisionKind[]).filter(
    (kind) => SUBDIVISION_NOTE_FRACTION[kind] < baseFraction,
  );

  if (finerSubdivisions.length === 0) {
    return {
      finerSubdivisions,
      disabledReason: 'Already using the finest pulse resolution.',
    };
  }

  return {
    finerSubdivisions,
    disabledReason: null,
  };
}

export function isFinerSubdivisionAvailable(
  denominator: number,
  subdivision: SubdivisionKind,
): boolean {
  return getSubdivisionAvailability(denominator).finerSubdivisions.includes(subdivision);
}

export function normalizeFinerSubdivision(
  denominator: number,
  finerSubdivision: FinerSubdivisionSelection,
): FinerSubdivisionSelection {
  if (finerSubdivision === null) {
    return null;
  }

  return isFinerSubdivisionAvailable(denominator, finerSubdivision) ? finerSubdivision : null;
}

/** Ticks per pulse cell sent to the native engine (base grid + optional finer subdivision). */
export function resolveTicksPerPulse(
  denominator: number,
  finerSubdivision: FinerSubdivisionSelection,
): number {
  const baseFraction = pulseFractionForDenominator(denominator);

  if (finerSubdivision === null) {
    return 1;
  }

  const finerFraction = SUBDIVISION_NOTE_FRACTION[finerSubdivision];
  const ticks = Math.round(baseFraction / finerFraction);

  return Math.max(1, ticks);
}

export function ticksToEngineSubdivisionKind(ticks: number): SubdivisionKind {
  if (ticks >= 4) {
    return 'sixteenth';
  }

  if (ticks === 3) {
    return 'triplet';
  }

  if (ticks === 2) {
    return 'eighth';
  }

  return 'quarter';
}

export function resolveEngineSubdivision(
  denominator: number,
  finerSubdivision: FinerSubdivisionSelection,
): SubdivisionKind {
  return ticksToEngineSubdivisionKind(resolveTicksPerPulse(denominator, finerSubdivision));
}

export function cycleFinerSubdivision(
  denominator: number,
  current: FinerSubdivisionSelection,
): FinerSubdivisionSelection {
  const { finerSubdivisions } = getSubdivisionAvailability(denominator);

  if (finerSubdivisions.length === 0) {
    return null;
  }

  if (current === null) {
    return finerSubdivisions[0] ?? null;
  }

  const currentIndex = finerSubdivisions.indexOf(current);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % (finerSubdivisions.length + 1);
  return nextIndex === finerSubdivisions.length ? null : finerSubdivisions[nextIndex] ?? null;
}

export function defaultAccentPatternForTimeSignature(timeSignature: TimeSignature): boolean[] {
  const meter = createMeter(timeSignature.numerator, timeSignature.denominator);
  const accents: boolean[] = [];
  let pulseIndex = 0;

  for (const groupSize of meter.grouping) {
    for (let pulse = 0; pulse < groupSize; pulse += 1) {
      accents[pulseIndex] = pulse === 0;
      pulseIndex += 1;
    }
  }

  return accents;
}

export function resolvePulseGridEngineConfig(input: {
  readonly displayBpm: number;
  readonly timeSignature: TimeSignature;
  readonly accentPattern: readonly boolean[];
  readonly finerSubdivision: FinerSubdivisionSelection;
}): PulseGridEngineConfig {
  const { displayBpm, timeSignature, accentPattern, finerSubdivision } = input;
  const normalizedFinerSubdivision = normalizeFinerSubdivision(
    timeSignature.denominator,
    finerSubdivision,
  );

  return {
    engineBpm: toEngineBpm(displayBpm, timeSignature.denominator),
    beatsPerMeasure: timeSignature.numerator,
    accentPattern,
    subdivision: resolveEngineSubdivision(timeSignature.denominator, normalizedFinerSubdivision),
    subdivisionAccentMode: DEFAULT_SUBDIVISION_ACCENT_MODE,
  };
}
