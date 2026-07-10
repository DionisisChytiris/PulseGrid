import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  cycleFinerSubdivision,
  type FinerSubdivisionSelection,
  type SubdivisionAvailability,
} from '../../../domain/metronome/PulseGridSettings';
import type { SubdivisionKind } from '../../../domain/valueObjects/Subdivision';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

const SUBDIVISION_SYMBOL: Record<SubdivisionKind, string> = {
  quarter: '♩',
  eighth: '♪',
  triplet: '3',
  sixteenth: '♬',
};

const SUBDIVISION_LABEL: Record<SubdivisionKind, string> = {
  quarter: '1/4',
  eighth: '1/8',
  triplet: '3',
  sixteenth: '1/16',
};

type SubdivisionCycleButtonProps = {
  denominator: number;
  finerSubdivision: FinerSubdivisionSelection;
  availability: SubdivisionAvailability;
  onSubdivisionChange: (subdivision: FinerSubdivisionSelection) => void;
};

export function SubdivisionCycleButton({
  denominator,
  finerSubdivision,
  availability,
  onSubdivisionChange,
}: SubdivisionCycleButtonProps) {
  const layout = useResponsiveLayout();
  const buttonSize = layout.scale(32, 0.05, 0.05);
  const disabled = availability.finerSubdivisions.length === 0;

  const label = finerSubdivision === null ? 'Base' : SUBDIVISION_LABEL[finerSubdivision];
  const symbol = finerSubdivision === null ? '•' : SUBDIVISION_SYMBOL[finerSubdivision];

  return (
    <Pressable
      onPress={() => {
        if (disabled) {
          return;
        }

        onSubdivisionChange(cycleFinerSubdivision(denominator, finerSubdivision));
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={
        disabled
          ? availability.disabledReason ?? 'Subdivision unavailable'
          : `${label} subdivision`
      }
      accessibilityHint={
        disabled ? availability.disabledReason ?? undefined : 'Tap to change subdivision'
      }
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
      <View style={styles.content}>
        <Text
          style={[
            styles.symbol,
            { fontSize: layout.scale(15) },
            Platform.OS === 'android' && styles.symbolAndroid,
            disabled && styles.textDisabled,
          ]}
        >
          {symbol}
        </Text>
        <Text style={[styles.label, { fontSize: layout.scale(9) }, disabled && styles.textDisabled]}>
          {disabled ? 'Fine' : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    color: studioColors.textPrimary,
    fontWeight: '600',
    lineHeight: undefined,
  },
  symbolAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  label: {
    color: studioColors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  textDisabled: {
    color: studioColors.textSecondary,
  },
});
