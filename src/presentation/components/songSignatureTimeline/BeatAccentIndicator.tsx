import { memo } from 'react';
import { View } from 'react-native';

import { studioColors } from '../../theme';
import { beatLedAppearance } from '../metronome/beatLedAppearance';
import { profileRender } from './songLineFollowProfiler';

type Props = {
  /** Strong/accented beat when true; weak/normal when false. */
  accented: boolean;
  size?: number;
  /** When true, use Quick Metronome LED playing/idle appearance. */
  isPlaying?: boolean;
  /** Highlight this pulse as the current song-playback beat. */
  isCurrentBeat?: boolean;
  /**
   * Idle fill for accented dots (tempo-region colour on Song Line).
   * Playing highlight is unchanged.
   */
  accentColor?: string;
};

/**
 * Signature-track pulse glyph.
 * Idle: accent ● / normal ○. Playing: same LED rules as Quick Metronome.
 */
export const BeatAccentIndicator = memo(function BeatAccentIndicator({
  accented,
  size = 18,
  isPlaying = false,
  isCurrentBeat = false,
  accentColor = studioColors.beatAccent,
}: Props) {
  profileRender('BeatAccentIndicator');
  const borderWidth = Math.max(1, Math.round(size * 0.12));
  const appearance = beatLedAppearance(
    isPlaying,
    isCurrentBeat,
    accented,
    borderWidth,
    accentColor,
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: appearance.backgroundColor,
        borderColor: appearance.borderColor,
        borderWidth: appearance.borderWidth,
        opacity: appearance.opacity,
      }}
      accessibilityRole="image"
      accessibilityLabel={
        isPlaying && isCurrentBeat
          ? accented
            ? 'Current accented beat'
            : 'Current beat'
          : accented
            ? 'Accented beat'
            : 'Normal beat'
      }
    />
  );
});
