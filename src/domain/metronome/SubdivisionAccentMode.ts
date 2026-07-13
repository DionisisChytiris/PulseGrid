/**
 * Controls accent behavior for subdivision pulses only.
 * Independent from the beat-level Accent Pattern.
 */
export const SubdivisionAccentMode = {
  /** No subdivision pulses are accented (default). */
  OFF: 'off',
  /** Accent the first pulse of each beat group. */
  GROUP_START: 'group_start',
  /** Accent every Nth subdivision pulse from the start of the bar. */
  EVERY_NTH: 'every_nth',
  /** User-defined subdivision accent map (future). */
  CUSTOM: 'custom',
} as const;

export type SubdivisionAccentMode =
  (typeof SubdivisionAccentMode)[keyof typeof SubdivisionAccentMode];

export const DEFAULT_SUBDIVISION_ACCENT_MODE: SubdivisionAccentMode =
  SubdivisionAccentMode.OFF;

export const DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH = 4;
export const MIN_SUBDIVISION_ACCENT_EVERY_NTH = 1;
export const MAX_SUBDIVISION_ACCENT_EVERY_NTH = 16;

export function isSubdivisionAccentMode(value: string): value is SubdivisionAccentMode {
  return Object.values(SubdivisionAccentMode).includes(value as SubdivisionAccentMode);
}

export function normalizeSubdivisionAccentMode(
  value: string | undefined,
): SubdivisionAccentMode {
  return value && isSubdivisionAccentMode(value) ? value : DEFAULT_SUBDIVISION_ACCENT_MODE;
}

export function normalizeSubdivisionAccentEveryNth(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH;
  }

  const rounded = Math.floor(value);
  if (rounded < MIN_SUBDIVISION_ACCENT_EVERY_NTH) {
    return MIN_SUBDIVISION_ACCENT_EVERY_NTH;
  }

  if (rounded > MAX_SUBDIVISION_ACCENT_EVERY_NTH) {
    return MAX_SUBDIVISION_ACCENT_EVERY_NTH;
  }

  return rounded;
}
