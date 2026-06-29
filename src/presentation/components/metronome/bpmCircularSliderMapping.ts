/**
 * BPM ↔ circular arc mapping for BpmCircularSlider.
 *
 * Revert to linear mapping anytime by setting:
 *   BPM_CIRCULAR_SLIDER_MAPPING_MODE = 'linear'
 */
export type BpmCircularSliderMappingMode = 'piecewise' | 'linear';

/** Switch to `'linear'` to restore the original full-range circle. */
export const BPM_CIRCULAR_SLIDER_MAPPING_MODE: BpmCircularSliderMappingMode = 'piecewise';

/** BPM where the circle switches from full-range (30–200) to half-range (200–600). */
export const BPM_RANGE_SPLIT = 200;

function clampBpm(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

export function angleToArcRatio(angleRadians: number): number {
  let normalized = angleRadians + Math.PI / 2;

  if (normalized < 0) {
    normalized += Math.PI * 2;
  }

  if (normalized >= Math.PI * 2) {
    normalized -= Math.PI * 2;
  }

  return normalized / (Math.PI * 2);
}

function arcRatioFromBpmLinear(
  value: number,
  minimumValue: number,
  maximumValue: number,
): number {
  const range = maximumValue - minimumValue;

  if (range <= 0) {
    return 0;
  }

  return (value - minimumValue) / range;
}

function arcRatioFromBpmPiecewise(
  value: number,
  minimumValue: number,
  maximumValue: number,
  split: number,
): number {
  if (value <= split) {
    const lowRange = split - minimumValue;

    if (lowRange <= 0) {
      return 0;
    }

    return (value - minimumValue) / lowRange;
  }

  const highRange = maximumValue - split;

  if (highRange <= 0) {
    return 0.5;
  }

  return 0.5 + ((value - split) / highRange) * 0.5;
}

export function arcRatioFromBpm(
  value: number,
  minimumValue: number,
  maximumValue: number,
  split: number = BPM_RANGE_SPLIT,
): number {
  if (BPM_CIRCULAR_SLIDER_MAPPING_MODE === 'linear') {
    return arcRatioFromBpmLinear(value, minimumValue, maximumValue);
  }

  return arcRatioFromBpmPiecewise(value, minimumValue, maximumValue, split);
}

function bpmFromArcRatioLinear(
  ratio: number,
  minimumValue: number,
  maximumValue: number,
): number {
  return clampBpm(
    minimumValue + ratio * (maximumValue - minimumValue),
    minimumValue,
    maximumValue,
  );
}

function bpmFromArcRatioPiecewise(
  ratio: number,
  minimumValue: number,
  maximumValue: number,
  currentValue: number,
  previousRatio: number | null,
  split: number,
): number {
  const lowRange = split - minimumValue;
  const highRange = maximumValue - split;

  const toLowRange = (arcRatio: number) => {
    const clampedRatio = Math.min(1, Math.max(0, arcRatio));
    return clampBpm(minimumValue + clampedRatio * lowRange, minimumValue, split);
  };

  const toHighRange = (arcRatio: number) => {
    const highRatio = (Math.min(1, Math.max(0.5, arcRatio)) - 0.5) / 0.5;
    return clampBpm(split + highRatio * highRange, split, maximumValue);
  };

  const inHighRange = currentValue > split;
  const nearSplit = currentValue >= split - 20;
  const crossedTopGoingUp =
    previousRatio !== null && previousRatio > 0.7 && ratio < 0.35 && nearSplit;
  const atSplitWrappedLow = !inHighRange && currentValue >= split && ratio < 0.35;

  // Crossing 200 upward: snap onto the high-range half (arc 50%+), never wrap to 30.
  if (!inHighRange && (crossedTopGoingUp || atSplitWrappedLow)) {
    return toHighRange(Math.max(0.5, 0.5 + ratio * 0.3));
  }

  // Crossing back below 200: high-range midpoint back to low-range top.
  if (
    inHighRange &&
    previousRatio !== null &&
    previousRatio <= 0.54 &&
    ratio > 0.88
  ) {
    return split;
  }

  if (inHighRange) {
    if (ratio < 0.5) {
      const ratioJump =
        previousRatio !== null ? Math.abs(ratio - previousRatio) : Number.POSITIVE_INFINITY;
      const descendingThroughMid =
        previousRatio !== null &&
        previousRatio > 0.5 &&
        previousRatio <= 0.58 &&
        ratio < previousRatio &&
        ratioJump < 0.2;

      if (descendingThroughMid) {
        return toLowRange(ratio / 0.5);
      }

      // Still in high range — hold at 200 (halfway mark), don't fall to 30.
      return split;
    }

    return toHighRange(ratio);
  }

  return toLowRange(ratio);
}

export function bpmFromArcRatio(
  ratio: number,
  minimumValue: number,
  maximumValue: number,
  currentValue: number,
  previousRatio: number | null = null,
  split: number = BPM_RANGE_SPLIT,
): number {
  if (BPM_CIRCULAR_SLIDER_MAPPING_MODE === 'linear') {
    return bpmFromArcRatioLinear(ratio, minimumValue, maximumValue);
  }

  return bpmFromArcRatioPiecewise(
    ratio,
    minimumValue,
    maximumValue,
    currentValue,
    previousRatio,
    split,
  );
}

export function bpmFromAngle(
  angleRadians: number,
  minimumValue: number,
  maximumValue: number,
  currentValue: number,
  previousRatio: number | null = null,
  split: number = BPM_RANGE_SPLIT,
): number {
  return bpmFromArcRatio(
    angleToArcRatio(angleRadians),
    minimumValue,
    maximumValue,
    currentValue,
    previousRatio,
    split,
  );
}
