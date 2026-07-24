/**
 * Effective playback BPM for a segment overview row
 * (override if set, otherwise song default).
 */
export function effectiveSegmentBpm(
  bpmOverride: number | null,
  songDefaultBpm: number,
): number {
  return bpmOverride ?? songDefaultBpm;
}

/**
 * Notation-style tempo markings: show BPM on the first segment and whenever
 * effective BPM changes vs the previous segment; otherwise blank.
 */
export function overviewTempoMarkings(
  segments: readonly { readonly bpmOverride: number | null }[],
  songDefaultBpm: number,
): readonly (number | null)[] {
  let previousEffective: number | null = null;

  return segments.map((segment, index) => {
    const effective = effectiveSegmentBpm(segment.bpmOverride, songDefaultBpm);
    const show = index === 0 || effective !== previousEffective;
    previousEffective = effective;
    return show ? effective : null;
  });
}
