import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { FinerSubdivisionSelection, SubdivisionAvailability } from '../../../domain/metronome/PulseGridSettings';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { SubdivisionCycleButton } from './SubdivisionCycleButton';
import { TapTempoButton } from './TapTempoButton';

type MetronomeToolbarProps = {
  bpm: number;
  minimumValue: number;
  maximumValue: number;
  denominator: number;
  finerSubdivision: FinerSubdivisionSelection;
  subdivisionAvailability: SubdivisionAvailability;
  onBpmChange: (value: number) => void;
  onTapTempo: () => void;
  onTapTempoHelp: () => void;
  onSubdivisionChange: (subdivision: FinerSubdivisionSelection) => void;
};

function clampBpm(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

type BpmStepButtonProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
  size: number;
  fontSize: number;
};

function BpmStepButton({ label, disabled, onPress, size, fontSize }: BpmStepButtonProps) {
  return (
    <Pressable
      style={[
        styles.stepButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        disabled && styles.stepButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label === '−' ? 'Decrease BPM' : 'Increase BPM'}
    >
      <Text
        allowFontScaling={false}
        style={[
          styles.stepButtonText,
          { fontSize, lineHeight: fontSize + 4 },
          disabled && styles.stepButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function MetronomeToolbar({
  bpm,
  minimumValue,
  maximumValue,
  denominator,
  finerSubdivision,
  subdivisionAvailability,
  onBpmChange,
  onTapTempo,
  onTapTempoHelp,
  onSubdivisionChange,
}: MetronomeToolbarProps) {
  const layout = useResponsiveLayout();
  const stepButtonSize = layout.scale(44, 0.05, 0.05);
  const stepFontSize = layout.displayFontSize(26, 0.04, 0.04);
  const atMin = bpm <= minimumValue;
  const atMax = bpm >= maximumValue;

  const adjustBpm = (delta: number) => {
    onBpmChange(clampBpm(bpm + delta, minimumValue, maximumValue));
  };

  return (
    <View
      style={[
        styles.toolbar,
        {
          gap: layout.scale(28, 0.05, 0.05),
          paddingTop: layout.scale(12, 0.05, 0.05),
          paddingBottom: layout.scale(4, 0.05, 0.05),
        },
      ]}
    >
      <TapTempoButton onPress={onTapTempo} onLongPress={onTapTempoHelp} />

      <BpmStepButton
        label="−"
        disabled={atMin}
        onPress={() => adjustBpm(-1)}
        size={stepButtonSize}
        fontSize={stepFontSize}
      />

      <BpmStepButton
        label="+"
        disabled={atMax}
        onPress={() => adjustBpm(1)}
        size={stepButtonSize}
        fontSize={stepFontSize}
      />

      <SubdivisionCycleButton
        denominator={denominator}
        finerSubdivision={finerSubdivision}
        availability={subdivisionAvailability}
        onSubdivisionChange={onSubdivisionChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stepButton: {
    backgroundColor: studioColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: {
    opacity: 0.35,
  },
  stepButtonText: {
    fontWeight: '400',
    color: studioColors.accent,
  },
  stepButtonTextDisabled: {
    color: studioColors.textMuted,
  },
});
