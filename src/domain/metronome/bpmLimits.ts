import type { SubdivisionKind } from '../valueObjects/Subdivision';

/** Global floor for Quick Metronome tempo. */
export const MIN_BPM = 30;

/**
 * Maximum engine BPM allowed per Quick Metronome subdivision.
 * Single source of truth — update here when adding subdivisions.
 */
export const MAX_BPM_BY_SUBDIVISION = {
  quarter: 500,
  eighth: 400,
  triplet: 300,
  sixteenth: 250,
} as const satisfies Record<SubdivisionKind, number>;

/** Highest cap across all subdivisions (quarter-note limit). */
export const ABSOLUTE_MAX_BPM = MAX_BPM_BY_SUBDIVISION.quarter;

export function maxBpmForSubdivision(kind: SubdivisionKind): number {
  return MAX_BPM_BY_SUBDIVISION[kind];
}

export function clampBpmForSubdivision(bpm: number, kind: SubdivisionKind): number {
  const rounded = Math.round(bpm);
  return Math.min(maxBpmForSubdivision(kind), Math.max(MIN_BPM, rounded));
}

/** User-facing labels for clamp toast copy. */
export const SUBDIVISION_TEMPO_LIMIT_LABEL: Record<SubdivisionKind, string> = {
  quarter: 'quarter notes',
  eighth: '8th notes',
  triplet: 'triplets',
  sixteenth: '16th notes',
};

export type BpmClampAdjustment = {
  readonly bpm: number;
  readonly maxBpm: number;
  readonly subdivision: SubdivisionKind;
};

export function formatBpmClampToastMessage(adjustment: BpmClampAdjustment): string {
  const label = SUBDIVISION_TEMPO_LIMIT_LABEL[adjustment.subdivision];
  return `Maximum tempo for ${label} is ${adjustment.maxBpm} BPM.\nTempo adjusted automatically.`;
}
