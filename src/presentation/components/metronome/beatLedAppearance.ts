import { studioColors } from '../../theme';

export type BeatLedAppearance = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
};

/**
 * Shared Quick Metronome / Song timeline beat-dot appearance.
 * Playing: current beat solid (accent orange / active blue); others dim.
 * Idle: accent filled (optional region colour); normal outline.
 */
export function beatLedAppearance(
  isPlaying: boolean,
  isCurrentBeat: boolean,
  isPatternAccent: boolean,
  borderWidth: number,
  /** Idle accent fill only — playing highlight stays on studio beat colours. */
  accentFillColor: string = studioColors.beatAccent,
): BeatLedAppearance {
  if (isPlaying) {
    if (isCurrentBeat) {
      const color = isPatternAccent ? studioColors.beatAccent : studioColors.beatActive;

      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        opacity: 1,
      };
    }

    return {
      backgroundColor: studioColors.beatInactivePlaying,
      borderColor: studioColors.beatInactivePlaying,
      borderWidth: 0,
      opacity: studioColors.beatLedRestingOpacity,
    };
  }

  if (isPatternAccent) {
    return {
      backgroundColor: accentFillColor,
      borderColor: accentFillColor,
      borderWidth: 0,
      opacity: 1,
    };
  }

  return {
    backgroundColor: 'transparent',
    borderColor: studioColors.beatBorderIdle,
    borderWidth,
    opacity: 1,
  };
}
