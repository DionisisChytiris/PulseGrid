/** Landscape Signature Track sizing — prefer width over shrinking cards. */
export const BEAT_SIZE = 16;
/**
 * Fixed musical ruler unit (one quarter-note grid division).
 * Wider values give a more spacious Cubase-style timeline without
 * changing musical alignment — pulse slots scale proportionally.
 */
export const GRID_SLOT_WIDTH = 44;
/** @deprecated Prefer GRID_SLOT_WIDTH — kept as alias for the quarter-note ruler. */
export const BEAT_SLOT_WIDTH = GRID_SLOT_WIDTH;
export const BEAT_GAP = 0;
export const BAR_CELL_PADDING_H = 0;
export const BAR_CELL_PADDING_V = 12;
export const BAR_DIVIDER_WIDTH = 0;
export const REGION_GAP = 0;
export const REGION_PADDING = 0;
export const REGION_MIN_WIDTH = 0;
export const TRACK_HEIGHT = 96;

const DEFAULT_DENOMINATOR = 4;

/** Supported pulse densites relative to the fixed quarter-note grid. */
export function pulsesPerGridDivision(denominator: number): number {
  switch (denominator) {
    case 2:
      return 0.5;
    case 4:
      return 1;
    case 8:
      return 2;
    case 16:
      return 4;
    case 32:
      return 8;
    default:
      return DEFAULT_DENOMINATOR / 4;
  }
}

/** Horizontal span of one pulse marker on the fixed grid. */
export function pulseSlotWidth(denominator: number): number {
  return GRID_SLOT_WIDTH / pulsesPerGridDivision(denominator);
}

/**
 * X position of a pulse marker's centre within a bar.
 * Pulse 0 of each quarter-note group sits on the grid line; further
 * subdivision pulses fall evenly between that line and the next.
 */
export function pulseMarkerCenterX(pulseIndex: number, denominator: number): number {
  return pulseIndex * pulseSlotWidth(denominator);
}

/** Parse "numerator/denominator" meter labels used by timeline view models. */
export function parseMeterDenominator(meterLabel: string): number {
  const denominator = Number(meterLabel.split('/')[1]);
  return Number.isFinite(denominator) && denominator > 0 ? denominator : DEFAULT_DENOMINATOR;
}

/**
 * Width of one bar cell.
 * Bar span follows musical duration in quarter-note grid units:
 * numerator × (4 / denominator) × GRID_SLOT_WIDTH.
 */
export function barCellWidth(beatCount: number, denominator: number = DEFAULT_DENOMINATOR): number {
  const beats = Math.max(1, beatCount);
  return beats * pulseSlotWidth(denominator);
}

/** Marker size capped so dense denominators still fit inside their pulse slot. */
export function pulseMarkerSize(denominator: number): number {
  const slot = pulseSlotWidth(denominator);
  return Math.max(7, Math.min(BEAT_SIZE, slot * 0.65));
}

/** Fixed width of a meter region: N bar cells on the quarter-note ruler. */
export function meterRegionWidth(
  numberOfBars: number,
  beatCount: number,
  denominator: number = DEFAULT_DENOMINATOR,
): number {
  const bars = Math.max(1, numberOfBars);
  const cell = barCellWidth(beatCount, denominator);
  const trackWidth = bars * cell;
  return Math.max(REGION_MIN_WIDTH, REGION_PADDING * 2 + trackWidth);
}

/** @deprecated Use meterRegionWidth */
export const meterRegionCardWidth = meterRegionWidth;

export const BAR_GAP = 0;
export const REGION_CARD_PADDING = REGION_PADDING;
