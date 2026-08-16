import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type VolumeButtonProps = {
  isOpen: boolean;
  onPress: () => void;
};

export function VolumeButton({ isOpen, onPress }: VolumeButtonProps) {
  const layout = useResponsiveLayout();
  const iconSize = layout.scale(22, 0.05, 0.05);
  const padding = layout.scale(12, 0.05, 0.05);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Volume"
      accessibilityState={{ expanded: isOpen }}
      accessibilityHint="Shows volume controls for bar, accent, and normal beats"
      style={({ pressed }) => [
        styles.button,
        { padding },
        pressed && styles.buttonPressed,
      ]}
    >
      <Ionicons
        name="volume-high"
        size={iconSize}
        color={isOpen ? studioColors.accent : studioColors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.75,
  },
});
