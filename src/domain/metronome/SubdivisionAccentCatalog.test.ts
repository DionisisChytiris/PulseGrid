import {
  CUSTOM_SUBDIVISION_ACCENT_UNAVAILABLE_MESSAGE,
  isCustomSubdivisionAccentAvailable,
} from './SubdivisionAccentCatalog';

describe('isCustomSubdivisionAccentAvailable', () => {
  it('enables CUSTOM only for sixteenth-note grids', () => {
    expect(isCustomSubdivisionAccentAvailable('sixteenth')).toBe(true);
    expect(isCustomSubdivisionAccentAvailable('quarter')).toBe(false);
    expect(isCustomSubdivisionAccentAvailable('eighth')).toBe(false);
    expect(isCustomSubdivisionAccentAvailable('triplet')).toBe(false);
  });

  it('exposes a helpful unavailable message', () => {
    expect(CUSTOM_SUBDIVISION_ACCENT_UNAVAILABLE_MESSAGE).toContain('16th');
  });
});
