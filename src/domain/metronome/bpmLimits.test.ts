import {
  ABSOLUTE_MAX_BPM,
  MAX_BPM_BY_SUBDIVISION,
  MIN_BPM,
  clampBpmForSubdivision,
  maxBpmForSubdivision,
} from './bpmLimits';

describe('bpmLimits', () => {
  it('exposes the expected subdivision caps', () => {
    expect(MAX_BPM_BY_SUBDIVISION).toEqual({
      quarter: 500,
      eighth: 400,
      triplet: 300,
      sixteenth: 250,
    });
    expect(ABSOLUTE_MAX_BPM).toBe(500);
    expect(MIN_BPM).toBe(30);
  });

  it('clamps above the subdivision maximum', () => {
    expect(clampBpmForSubdivision(340, 'sixteenth')).toBe(250);
    expect(clampBpmForSubdivision(401, 'eighth')).toBe(400);
    expect(clampBpmForSubdivision(600, 'triplet')).toBe(300);
  });

  it('clamps below the global minimum', () => {
    expect(clampBpmForSubdivision(10, 'quarter')).toBe(30);
  });

  it('leaves in-range tempos unchanged', () => {
    expect(clampBpmForSubdivision(250, 'sixteenth')).toBe(250);
    expect(clampBpmForSubdivision(120, 'quarter')).toBe(120);
  });

  it('maxBpmForSubdivision mirrors the table', () => {
    expect(maxBpmForSubdivision('triplet')).toBe(300);
  });
});
