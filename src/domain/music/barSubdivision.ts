import {
  normalizeFinerSubdivision,
  resolveEngineSubdivision,
  resolveTicksPerPulse,
  type FinerSubdivisionSelection,
} from '../metronome/PulseGridSettings';
import type { SubdivisionKind } from '../valueObjects/Subdivision';
import { NATIVE_SUBDIVISION_ORDER } from '../valueObjects/Subdivision';

import type { Bar } from './Bar';

/** Default when the optional bar field is absent (backward compatible). */
export const DEFAULT_BAR_SUBDIVISION: SubdivisionKind = 'quarter';

/** Timeline Builder only exposes subdivision for /2 and /4 bars. */
export function isBarSubdivisionEditable(denominator: number): boolean {
  return denominator === 2 || denominator === 4;
}

export function parseStoredBarSubdivision(value: unknown): SubdivisionKind | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return (NATIVE_SUBDIVISION_ORDER as readonly string[]).includes(value)
    ? (value as SubdivisionKind)
    : undefined;
}

/** Effective subdivision for a bar — absent field means Quarter. */
export function resolveBarSubdivision(bar: Pick<Bar, 'subdivision'>): SubdivisionKind {
  return bar.subdivision ?? DEFAULT_BAR_SUBDIVISION;
}

/**
 * Maps stored bar subdivision onto the Quick Metronome finer-subdivision model
 * used by resolveTicksPerPulse / resolveEngineSubdivision.
 *
 * /4: Quarter → base pulse (null). /2: Quarter → finer 'quarter'.
 */
export function toBarFinerSubdivision(
  denominator: number,
  subdivision: SubdivisionKind = DEFAULT_BAR_SUBDIVISION,
): FinerSubdivisionSelection {
  if (!isBarSubdivisionEditable(denominator)) {
    return null;
  }

  if (denominator === 4 && subdivision === 'quarter') {
    return null;
  }

  return normalizeFinerSubdivision(denominator, subdivision);
}

export function resolveBarFinerSubdivision(
  bar: Pick<Bar, 'meter' | 'subdivision'>,
): FinerSubdivisionSelection {
  // Absent field → base pulse (legacy songs + Quick Metronome default).
  if (bar.subdivision === undefined) {
    return null;
  }

  return toBarFinerSubdivision(bar.meter.denominator, bar.subdivision);
}

/** Ticks per primary pulse — same path as Quick Metronome. */
export function resolveBarTicksPerPulse(bar: Pick<Bar, 'meter' | 'subdivision'>): number {
  return resolveTicksPerPulse(bar.meter.denominator, resolveBarFinerSubdivision(bar));
}

/** Engine subdivision kind for BPM caps — same path as Quick Metronome. */
export function resolveBarEngineSubdivision(
  bar: Pick<Bar, 'meter' | 'subdivision'>,
): SubdivisionKind {
  return resolveEngineSubdivision(bar.meter.denominator, resolveBarFinerSubdivision(bar));
}

/** Uniform subdivision across bars, or Quarter when mixed/absent. */
export function segmentSubdivision(bars: readonly Pick<Bar, 'subdivision'>[]): SubdivisionKind {
  if (bars.length === 0) {
    return DEFAULT_BAR_SUBDIVISION;
  }

  const first = resolveBarSubdivision(bars[0]!);
  const allSame = bars.every((bar) => resolveBarSubdivision(bar) === first);
  return allSame ? first : DEFAULT_BAR_SUBDIVISION;
}

/**
 * Keeps a stored subdivision valid for the bar's denominator.
 * Unsupported meters drop back to Quarter (field omitted by callers if desired).
 */
export function normalizeBarSubdivisionForMeter(
  denominator: number,
  subdivision: SubdivisionKind | undefined,
): SubdivisionKind | undefined {
  if (!isBarSubdivisionEditable(denominator)) {
    return undefined;
  }

  const resolved = subdivision ?? DEFAULT_BAR_SUBDIVISION;
  if (resolved === DEFAULT_BAR_SUBDIVISION) {
    // /4: Quarter ≡ base pulse → omit field.
    // /2: Quarter is a finer subdivision in Quick Metronome → persist it.
    return denominator === 2 ? 'quarter' : undefined;
  }

  const finer = toBarFinerSubdivision(denominator, resolved);
  if (finer === null) {
    return undefined;
  }

  return finer;
}
