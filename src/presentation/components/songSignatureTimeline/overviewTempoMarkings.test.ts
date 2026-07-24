import {
  effectiveSegmentBpm,
  overviewTempoMarkings,
} from './overviewTempoMarkings';

describe('overviewTempoMarkings', () => {
  it('resolves effective BPM from override or song default', () => {
    expect(effectiveSegmentBpm(null, 120)).toBe(120);
    expect(effectiveSegmentBpm(95, 120)).toBe(95);
  });

  it('always marks the first segment and only subsequent tempo changes', () => {
    const markings = overviewTempoMarkings(
      [
        { bpmOverride: null }, // 120
        { bpmOverride: null }, // 120 — hidden
        { bpmOverride: 95 }, // change
        { bpmOverride: null }, // back to 120 — show
        { bpmOverride: 140 }, // change
      ],
      120,
    );

    expect(markings).toEqual([120, null, 95, 120, 140]);
  });

  it('shows song tempo on first segment even when inherited', () => {
    expect(overviewTempoMarkings([{ bpmOverride: null }], 108)).toEqual([108]);
  });
});
