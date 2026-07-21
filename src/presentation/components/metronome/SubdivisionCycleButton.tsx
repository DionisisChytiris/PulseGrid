import { Pressable, StyleSheet, View } from 'react-native';

import {
  cycleFinerSubdivision,
  type FinerSubdivisionSelection,
  type SubdivisionAvailability,
} from '../../../domain/metronome/PulseGridSettings';
import type { SubdivisionKind } from '../../../domain/valueObjects/Subdivision';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { SubdivisionIcon } from '../music/SubdivisionIcon';

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
  const buttonSize = layout.scale(53, 0.05, 0.05);
  const iconSize = layout.scale(30, 0.05, 0.05);
  const disabled = availability.finerSubdivisions.length === 0;

  const label = finerSubdivision === null ? 'Base' : SUBDIVISION_LABEL[finerSubdivision];
  const iconColor = disabled ? studioColors.textSecondary : studioColors.textPrimary;
  // null = base pulse; visually a quarter note, without putting "quarter" in the finer cycle.
  const iconType = finerSubdivision ?? 'quarter';

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
          borderRadius: buttonSize / 3,
          paddingHorizontal: layout.scale(6),
          paddingVertical: layout.scale(4),
        },
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <View style={styles.content}>
        <SubdivisionIcon type={iconType} size={iconSize} color={iconColor} />
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
});
