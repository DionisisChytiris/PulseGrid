import { MAX_BPM, MID_BPM, MIN_BPM } from './bpmRotaryMapping';

/** Completed first-revolution color (240 BPM). */
export const FIRST_REV_COMPLETE_COLOR = '#00D4FF';

export type Rgb = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

export type TempoRingSegment = {
  /** Segment centre position around the ring, 0–1. */
  readonly ratio: number;
  readonly color: string;
};

const FIRST_REV_RANGE = MID_BPM - MIN_BPM;
const SECOND_REV_RANGE = MAX_BPM - MID_BPM;

const FIRST_REV_STOPS: readonly { t: number; color: Rgb }[] = [
  { t: 0, color: { r: 103, g: 232, b: 249 } }, // light cyan @ 30 BPM
  { t: (120 - MIN_BPM) / FIRST_REV_RANGE, color: { r: 59, g: 130, b: 246 } }, // blue @ 120
  { t: 1, color: { r: 0, g: 212, b: 255 } }, // electric blue @ 240
];

const SECOND_REV_STOPS: readonly { t: number; color: Rgb }[] = [
  { t: 0, color: { r: 0, g: 212, b: 255 } }, // electric blue @ 240
  { t: 0.5, color: { r: 99, g: 102, b: 241 } }, // indigo @ 420
  { t: 1, color: { r: 168, g: 85, b: 247 } }, // purple @ 600
];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function interpolateStops(stops: readonly { t: number; color: Rgb }[], t: number): Rgb {
  const clamped = clamp01(t);

  if (clamped <= stops[0].t) {
    return stops[0].color;
  }

  const last = stops[stops.length - 1];
  if (clamped >= last.t) {
    return last.color;
  }

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];

    if (clamped >= start.t && clamped <= end.t) {
      const span = end.t - start.t;
      const localT = span === 0 ? 0 : (clamped - start.t) / span;
      return {
        r: Math.round(start.color.r + (end.color.r - start.color.r) * localT),
        g: Math.round(start.color.g + (end.color.g - start.color.g) * localT),
        b: Math.round(start.color.b + (end.color.b - start.color.b) * localT),
      };
    }
  }

  return last.color;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Color along the first revolution ramp (t = 0 at 30 BPM, t = 1 at 240 BPM). */
export function getFirstRevColor(progress: number): string {
  return rgbToHex(interpolateStops(FIRST_REV_STOPS, progress));
}

/** Color along the second revolution ramp (t = 0 at 240 BPM, t = 1 at 600 BPM). */
export function getSecondRevColor(progress: number): string {
  return rgbToHex(interpolateStops(SECOND_REV_STOPS, progress));
}

/** Thumb and live tempo accent color for the current BPM. */
export function getTempoRingColor(bpm: number): string {
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));

  if (clamped <= MID_BPM) {
    return getFirstRevColor((clamped - MIN_BPM) / FIRST_REV_RANGE);
  }

  return getSecondRevColor((clamped - MID_BPM) / SECOND_REV_RANGE);
}

export function getFirstRevFill(bpm: number): number {
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
  if (clamped >= MID_BPM) {
    return 1;
  }

  return clamp01((clamped - MIN_BPM) / FIRST_REV_RANGE);
}

export function getSecondRevFill(bpm: number): number {
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
  if (clamped <= MID_BPM) {
    return 0;
  }

  return clamp01((clamped - MID_BPM) / SECOND_REV_RANGE);
}

/**
 * Colored arc segments for the tempo ring.
 * First revolution fills 0→1; second revolution overlays without erasing the first.
 */
export function getTempoRingSegments(bpm: number, segmentCount: number): TempoRingSegment[] {
  const firstFill = getFirstRevFill(bpm);
  const secondFill = getSecondRevFill(bpm);
  const firstRevComplete = bpm >= MID_BPM;

  return Array.from({ length: segmentCount }, (_, index) => {
    const ratio = (index + 0.5) / segmentCount;

    if (bpm > MID_BPM && ratio < secondFill) {
      return {
        ratio,
        color: getSecondRevColor(ratio),
      };
    }

    if (firstRevComplete || ratio < firstFill) {
      return {
        ratio,
        color: firstRevComplete ? FIRST_REV_COMPLETE_COLOR : getFirstRevColor(ratio),
      };
    }

    return {
      ratio,
      color: 'transparent',
    };
  }).filter((segment) => segment.color !== 'transparent');
}
