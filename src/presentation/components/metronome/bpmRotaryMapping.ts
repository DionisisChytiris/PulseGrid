export const MIN_BPM = 30;
export const MID_BPM = 240;
export const MAX_BPM = 600;

export const MIN_ROTATION = 0;
export const MID_ROTATION = Math.PI * 2;
export const MAX_ROTATION = Math.PI * 4;

const TWO_PI = Math.PI * 2;
const FIRST_REV_BPM_RANGE = MID_BPM - MIN_BPM;
const SECOND_REV_BPM_RANGE = MAX_BPM - MID_BPM;

/** Clamp logical knob rotation to the two-turn range [0, 4π]. */
export function clampRotation(rotation: number): number {
  return Math.min(MAX_ROTATION, Math.max(MIN_ROTATION, rotation));
}

/**
 * Signed shortest angular difference from [from] to [to] in radians.
 * Result is always in (-π, π] — crossing 0°/360° never yields a ±357° jump.
 */
export function shortestAngleDelta(fromRadians: number, toRadians: number): number {
  let delta = toRadians - fromRadians;
  delta = ((delta + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
  return delta;
}

/** Map bounded knob rotation to continuous BPM (30 at 0, 240 at 2π, 600 at 4π). */
export function rotationToBpm(rotation: number): number {
  const clamped = clampRotation(rotation);

  if (clamped <= MID_ROTATION) {
    return MIN_BPM + (clamped / MID_ROTATION) * FIRST_REV_BPM_RANGE;
  }

  const secondRevProgress = (clamped - MID_ROTATION) / (MAX_ROTATION - MID_ROTATION);
  return MID_BPM + secondRevProgress * SECOND_REV_BPM_RANGE;
}

/** Inverse of rotationToBpm for BPM in [30, 600]. */
export function bpmToRotation(bpm: number): number {
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

  if (clamped <= MID_BPM) {
    const progress = (clamped - MIN_BPM) / FIRST_REV_BPM_RANGE;
    return progress * MID_ROTATION;
  }

  const progress = (clamped - MID_BPM) / SECOND_REV_BPM_RANGE;
  return MID_ROTATION + progress * (MAX_ROTATION - MID_ROTATION);
}
