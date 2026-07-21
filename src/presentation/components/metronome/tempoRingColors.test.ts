import {
  FIRST_REV_COMPLETE_COLOR,
  getFirstRevColor,
  getSecondRevColor,
  getSecondRevFill,
  getTempoRingColor,
  getTempoRingSegments,
} from './tempoRingColors';

describe('tempoRingColors', () => {
  it('maps anchor BPM values to expected revolution colors', () => {
    expect(getTempoRingColor(30)).toBe(getFirstRevColor(0));
    expect(getTempoRingColor(240)).toBe(FIRST_REV_COMPLETE_COLOR);
    expect(getTempoRingColor(600)).toBe(getSecondRevColor(1));
  });

  it('keeps the first revolution completed above 240 BPM', () => {
    const segments = getTempoRingSegments(300, 72);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.color !== 'transparent')).toBe(true);
    expect(getSecondRevFill(300)).toBeCloseTo(60 / 360, 5);
  });

  it('empties the second revolution before the first when decreasing', () => {
    expect(getSecondRevFill(240)).toBe(0);
    expect(getSecondRevFill(300)).toBeGreaterThan(0);
    expect(getTempoRingSegments(240, 72).length).toBe(72);
    expect(getTempoRingSegments(120, 72).length).toBeLessThan(72);
    expect(getTempoRingSegments(30, 72).length).toBe(0);
  });

  it('interpolates smoothly without identical endpoints across the range', () => {
    const samples = [30, 60, 120, 180, 240, 300, 420, 600];
    const colors = samples.map(getTempoRingColor);
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(4);
  });
});
