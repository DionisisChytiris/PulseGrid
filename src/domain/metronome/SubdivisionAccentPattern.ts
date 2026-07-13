/**
 * Repeating boolean flags for subdivision accent placement.
 * Independent from the beat-level accent pattern.
 *
 * Pattern wraps when the subdivision index exceeds pattern length.
 */
export type SubdivisionAccentPattern = readonly boolean[];

export const DEFAULT_SUBDIVISION_ACCENT_PATTERN: SubdivisionAccentPattern = [];

/** Default custom pattern when none has been saved yet. */
export const INITIAL_SUBDIVISION_ACCENT_CUSTOM_PATTERN: SubdivisionAccentPattern = [
  true,
  false,
  false,
  true,
];

export const CUSTOM_SUBDIVISION_ACCENT_PATTERN_LENGTH = 4;

export function isSubdivisionAccentPattern(value: unknown): value is SubdivisionAccentPattern {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === 'boolean')
  );
}

export function normalizeSubdivisionAccentPattern(
  value: unknown,
): SubdivisionAccentPattern {
  if (!isSubdivisionAccentPattern(value)) {
    return DEFAULT_SUBDIVISION_ACCENT_PATTERN;
  }

  return [...value];
}

/**
 * Whether the subdivision at the given index is accented by the custom pattern.
 * Empty patterns never accent.
 */
export function resolveCustomSubdivisionAccent(
  subdivisionIndex: number,
  pattern: SubdivisionAccentPattern,
): boolean {
  if (pattern.length === 0) {
    return false;
  }

  return pattern[subdivisionIndex % pattern.length] ?? false;
}
