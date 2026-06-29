import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import type { SubdivisionKind } from '../../../domain/valueObjects/Subdivision';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

const SUBDIVISION_ORDER: SubdivisionKind[] = ['quarter', 'eighth', 'triplet', 'sixteenth'];

const SUBDIVISION_SYMBOL: Record<SubdivisionKind, string> = {
  quarter: '♩',
  eighth: '♪',
  triplet: '3',
  sixteenth: '♬',
};

type SubdivisionCycleButtonProps = {
  subdivision: SubdivisionKind;
  onSubdivisionChange: (subdivision: SubdivisionKind) => void;
  disabled?: boolean;
};

export function SubdivisionCycleButton({
  subdivision,
  onSubdivisionChange,
  disabled = false,
}: SubdivisionCycleButtonProps) {
  const layout = useResponsiveLayout();
  const buttonSize = layout.scale(32, 0.05, 0.05);

  const cycleSubdivision = () => {
    const currentIndex = SUBDIVISION_ORDER.indexOf(subdivision);
    const nextIndex = (currentIndex + 1) % SUBDIVISION_ORDER.length;
    onSubdivisionChange(SUBDIVISION_ORDER[nextIndex]);
  };

  return (
    <Pressable
      onPress={cycleSubdivision}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${subdivision} subdivision`}
      accessibilityHint="Tap to change subdivision"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
        },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.symbol,
          { fontSize: layout.scale(15) },
          Platform.OS === 'android' && styles.symbolAndroid,
        ]}
      >
        {SUBDIVISION_SYMBOL[subdivision]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  symbol: {
    color: '#1C1C1E',
    fontWeight: '600',
    lineHeight: undefined,
  },
  symbolAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
