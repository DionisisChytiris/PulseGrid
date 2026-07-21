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
        },
        disabled && styles.stepButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label === '−' ? 'Decrease BPM' : 'Increase BPM'}
      hitSlop={6}
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
  const stepButtonSize = layout.scale(40, 0.05, 0.05);
  const stepFontSize = layout.displayFontSize(26, 0.04, 0.04);
  const stepPairGap = layout.scale(16, 0.05, 0.05);
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
          paddingTop: layout.scale(12, 0.05, 0.05),
          paddingBottom: layout.scale(4, 0.05, 0.05),
        },
      ]}
    >
      <View style={styles.sideSlot}>
        <TapTempoButton onPress={onTapTempo} onLongPress={onTapTempoHelp} />
      </View>

      <View style={[styles.stepPair, { gap: stepPairGap }]}>
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
      </View>

      <View style={[styles.sideSlot, styles.sideSlotEnd]}>
        <SubdivisionCycleButton
          denominator={denominator}
          finerSubdivision={finerSubdivision}
          availability={subdivisionAvailability}
          onSubdivisionChange={onSubdivisionChange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  sideSlot: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  stepPair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
