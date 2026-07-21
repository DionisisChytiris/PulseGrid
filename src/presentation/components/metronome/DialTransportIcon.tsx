import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { studioColors } from '../../theme';

type DialTransportIconProps = {
  isPlaying: boolean;
  size: number;
};

/** Accent-colored play/stop glyph with no button chrome. */
export function DialTransportIcon({ isPlaying, size }: DialTransportIconProps) {
  const color = isPlaying ? '#FF00FF' : studioColors.accent;
  return (
    <Ionicons
      name={isPlaying ? 'stop' : 'play'}
      size={size}
      color={color}
      style={!isPlaying && Platform.OS === 'android' ? styles.playIconOffset : undefined}
    />
  );
}

const styles = StyleSheet.create({
  playIconOffset: {
    marginLeft: 2,
  },
});
