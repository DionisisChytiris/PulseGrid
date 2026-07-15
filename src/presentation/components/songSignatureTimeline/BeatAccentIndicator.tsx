import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { studioColors } from '../../theme';

type Props = {
  /** Strong/accented beat when true; weak/normal when false. */
  accented: boolean;
  size?: number;
};

/** Single beat glyph: filled ● for accent, open ○ for normal. */
export const BeatAccentIndicator = memo(function BeatAccentIndicator({
  accented,
  size = 18,
}: Props) {
  const radius = size / 2;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        accented ? styles.accented : styles.normal,
      ]}
      accessibilityRole="image"
      accessibilityLabel={accented ? 'Accented beat' : 'Normal beat'}
    />
  );
});

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
  },
  accented: {
    backgroundColor: studioColors.beatAccent,
    borderColor: studioColors.beatAccent,
  },
  normal: {
    backgroundColor: 'transparent',
    borderColor: studioColors.beatInactive,
  },
});
