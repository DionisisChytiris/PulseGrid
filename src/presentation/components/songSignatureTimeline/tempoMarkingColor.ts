import {
  FIRST_REV_COMPLETE_COLOR,
  getFirstRevColor,
  getSecondRevColor,
  getTempoRingColor,
} from '../metronome/tempoRingColors';

export type SongLineRegionColors = {
  /** Full-intensity BPM colour for ♩ = N. */
  readonly tempoColour: string;
  /** Same as tempo — idle accented beat dots. */
  readonly accentDotColour: string;
  /** Same bright BPM colour — time signature stays equally readable. */
  readonly timeSignatureColour: string;
};

/**
 * Discrete BPM → colour for Song Line tempo text (♩ = N).
 * Blue → purple bands sampled from the Quick Metronome ring palette only.
 */
export function getTempoMarkingColor(bpm: number): string {
  const value = Number.isFinite(bpm) ? bpm : 120;

  if (value <= 60) {
    // 30–60: Soft Light Blue — ring start
    return getFirstRevColor(0);
  }

  if (value <= 90) {
    // 61–90: Light Blue — first-rev ramp toward 120
    return getTempoRingColor(75);
  }

  if (value <= 120) {
    // 91–120: Bright Blue — ring blue anchor
    return getTempoRingColor(120);
  }

  if (value <= 145) {
    // 121–145: Electric Blue — first-rev complete accent
    return FIRST_REV_COMPLETE_COLOR;
  }

  if (value <= 170) {
    // 146–170: Blue-Violet — between electric and indigo
    return getSecondRevColor(0.25);
  }

  if (value <= 190) {
    // 171–190: Violet — second-rev indigo stop
    return getSecondRevColor(0.5);
  }

  // 191+: Purple / Magenta — ring end
  return getSecondRevColor(1);
}

/**
 * Song Line region palette from one BPM colour source.
 * Time signature, tempo text, and accented dots share the same bright colour.
 */
export function getSongLineRegionColors(bpm: number): SongLineRegionColors {
  const colour = getTempoMarkingColor(bpm);

  return {
    tempoColour: colour,
    accentDotColour: colour,
    timeSignatureColour: colour,
  };
}
