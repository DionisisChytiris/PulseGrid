import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  NATIVE_SUBDIVISION_ORDER,
  toNativeSubdivision,
  type NativeSubdivisionKind,
  type SubdivisionKind,
} from '../../../domain/valueObjects/Subdivision';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

const SUBDIVISION_SYMBOL: Record<NativeSubdivisionKind, string> = {
  quarter: '♩',
  eighth: '♪',
  triplet: '3',
  sixteenth: '♬',
};

const SUBDIVISION_LABEL: Record<NativeSubdivisionKind, string> = {
  quarter: '1/4',
  eighth: '1/8',
  triplet: '3',
  sixteenth: '1/16',
};

type SubdivisionCycleButtonProps = {
  subdivision: SubdivisionKind;
  onSubdivisionChange: (subdivision: SubdivisionKind) => void;
};

export function SubdivisionCycleButton({
  subdivision,
  onSubdivisionChange,
}: SubdivisionCycleButtonProps) {
  const layout = useResponsiveLayout();
  const buttonSize = layout.scale(32, 0.05, 0.05);
  const currentSubdivision = toNativeSubdivision(subdivision);

  const cycleSubdivision = () => {
    const currentIndex = NATIVE_SUBDIVISION_ORDER.indexOf(currentSubdivision);
    const nextIndex = (currentIndex + 1) % NATIVE_SUBDIVISION_ORDER.length;
    onSubdivisionChange(NATIVE_SUBDIVISION_ORDER[nextIndex]);
  };

  return (
    <Pressable
      onPress={cycleSubdivision}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${SUBDIVISION_LABEL[currentSubdivision]} subdivision`}
      accessibilityHint="Tap to change subdivision"
      style={({ pressed }) => [
        styles.button,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
        },
        pressed && styles.buttonPressed,
      ]}
    >
      <View style={styles.content}>
        <Text
          style={[
            styles.symbol,
            { fontSize: layout.scale(15) },
            Platform.OS === 'android' && styles.symbolAndroid,
          ]}
        >
          {SUBDIVISION_SYMBOL[currentSubdivision]}
        </Text>
        <Text style={[styles.label, { fontSize: layout.scale(9) }]}>
          {SUBDIVISION_LABEL[currentSubdivision]}
        </Text>
      </View>
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
  buttonPressed: {
    opacity: 0.75,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
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
  label: {
    color: '#636366',
    fontWeight: '500',
    marginTop: 1,
  },
});
