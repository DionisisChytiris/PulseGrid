import {
  DEFAULT_SUBDIVISION_ACCENT_PATTERN,
  normalizeSubdivisionAccentPattern,
  resolveCustomSubdivisionAccent,
} from './SubdivisionAccentPattern';

describe('SubdivisionAccentPattern', () => {
  it('normalizes invalid values to the default empty pattern', () => {
    expect(normalizeSubdivisionAccentPattern(undefined)).toEqual(
      DEFAULT_SUBDIVISION_ACCENT_PATTERN,
    );
    expect(normalizeSubdivisionAccentPattern(['not-bool'])).toEqual(
      DEFAULT_SUBDIVISION_ACCENT_PATTERN,
    );
  });

  it('copies valid boolean arrays', () => {
    const pattern = normalizeSubdivisionAccentPattern([true, false]);
    expect(pattern).toEqual([true, false]);
    expect(pattern).not.toBe([true, false]);
  });

  it('resolves single-value patterns', () => {
    expect(resolveCustomSubdivisionAccent(0, [true])).toBe(true);
    expect(resolveCustomSubdivisionAccent(3, [true])).toBe(true);
    expect(resolveCustomSubdivisionAccent(0, [false])).toBe(false);
    expect(resolveCustomSubdivisionAccent(5, [false])).toBe(false);
  });
});
