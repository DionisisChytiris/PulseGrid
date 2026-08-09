/** Per-timeline preparation bars before score playback. Not part of the score. */
export type CountInBars = 0 | 1 | 2 | 4;

export const DEFAULT_COUNT_IN_BARS: CountInBars = 2;

export const COUNT_IN_OPTIONS: readonly CountInBars[] = [0, 1, 2, 4];

export function isCountInBars(value: unknown): value is CountInBars {
  return value === 0 || value === 1 || value === 2 || value === 4;
}

/** Coerce persisted / UI values to a valid count-in; unknown → default None. */
export function normalizeCountInBars(value: unknown): CountInBars {
  if (isCountInBars(value)) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (isCountInBars(rounded)) {
      return rounded;
    }
  }

  return DEFAULT_COUNT_IN_BARS;
}

export function countInOptionLabel(bars: CountInBars): string {
  if (bars === 0) {
    return 'None';
  }

  if (bars === 1) {
    return '1 Bar';
  }

  return `${bars} Bars`;
}
