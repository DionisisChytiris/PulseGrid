/** Landscape Signature Track sizing — prefer width over shrinking cards. */
export const BEAT_SIZE = 16;
export const BEAT_GAP = 5;
export const BAR_CELL_PADDING_H = 10;
export const BAR_CELL_PADDING_V = 12;
export const BAR_DIVIDER_WIDTH = 1;
export const REGION_GAP = 20;
export const REGION_PADDING = 12;
export const REGION_MIN_WIDTH = 200;
export const TRACK_HEIGHT = 72;

/** Width of one bar cell from beat count (no shrink). */
export function barCellWidth(beatCount: number): number {
  const beats = Math.max(1, beatCount);
  const beatsWidth = beats * BEAT_SIZE + Math.max(0, beats - 1) * BEAT_GAP;
  return beatsWidth + BAR_CELL_PADDING_H * 2;
}

/** Fixed width of a meter region: padding + N bar cells + dividers. */
export function meterRegionWidth(numberOfBars: number, beatCount: number): number {
  const bars = Math.max(1, numberOfBars);
  const cell = barCellWidth(beatCount);
  const dividers = Math.max(0, bars - 1) * BAR_DIVIDER_WIDTH;
  const trackWidth = bars * cell + dividers;
  return Math.max(REGION_MIN_WIDTH, REGION_PADDING * 2 + trackWidth);
}

/** @deprecated Use meterRegionWidth */
export const meterRegionCardWidth = meterRegionWidth;

export const BAR_GAP = 0;
export const REGION_CARD_PADDING = REGION_PADDING;
