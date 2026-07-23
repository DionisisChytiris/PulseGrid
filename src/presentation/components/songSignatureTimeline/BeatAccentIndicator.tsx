import { memo } from 'react';
import { View } from 'react-native';

import { beatLedAppearance } from '../metronome/beatLedAppearance';

type Props = {
  /** Strong/accented beat when true; weak/normal when false. */
  accented: boolean;
  size?: number;
  /** When true, use Quick Metronome LED playing/idle appearance. */
  isPlaying?: boolean;
  /** Highlight this pulse as the current song-playback beat. */
  isCurrentBeat?: boolean;
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
}: Props) {
  const borderWidth = Math.max(1, Math.round(size * 0.12));
  const appearance = beatLedAppearance(isPlaying, isCurrentBeat, accented, borderWidth);

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
