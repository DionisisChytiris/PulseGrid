/**
 * Per-bar accent definition for song timeline mode.
 *
 * Named SongAccentPattern to avoid clashing with quick-metronome AccentPattern
 * in domain/valueObjects.
 */

/** Flat accent flags — one entry per beat in the bar. */
export interface AccentPatternSteps {
  readonly kind: 'steps';
  readonly steps: readonly boolean[];
}

/**
 * Grouped beats for asymmetric meters (e.g. 7/8 as 3+2+2).
 * Group sizes must sum to the bar's meter numerator when validated by editors.
 */
export interface AccentPatternGrouped {
  readonly kind: 'grouped';
  readonly groups: readonly number[];
  /** Accent the first beat of each group when true; otherwise all false. */
  readonly accentGroupStarts?: boolean;
}

export type SongAccentPattern = AccentPatternSteps | AccentPatternGrouped;

export function createAccentPatternSteps(steps: readonly boolean[]): AccentPatternSteps {
  if (steps.length === 0) {
    throw new RangeError('Accent pattern steps must not be empty');
  }

  return { kind: 'steps', steps: [...steps] };
}

export function createAccentPatternGrouped(
  groups: readonly number[],
  accentGroupStarts = true,
): AccentPatternGrouped {
  if (groups.length === 0) {
    throw new RangeError('Accent pattern groups must not be empty');
  }

  for (const size of groups) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError('Each accent group size must be a positive integer');
    }
  }

  return { kind: 'grouped', groups: [...groups], accentGroupStarts };
}

/** Default: accent on beat 1 only for the given beat count. */
export function downbeatAccentPattern(beatCount: number): AccentPatternSteps {
  if (!Number.isInteger(beatCount) || beatCount <= 0) {
    throw new RangeError('Beat count must be a positive integer');
  }

  return createAccentPatternSteps([
    true,
    ...Array.from({ length: beatCount - 1 }, () => false),
  ]);
}

export function cloneSongAccentPattern(pattern: SongAccentPattern): SongAccentPattern {
  if (pattern.kind === 'steps') {
    return createAccentPatternSteps(pattern.steps);
  }

  return createAccentPatternGrouped(pattern.groups, pattern.accentGroupStarts ?? true);
}
