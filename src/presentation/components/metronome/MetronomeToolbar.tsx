import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRef } from 'react';

import type { FinerSubdivisionSelection, SubdivisionAvailability } from '../../../domain/metronome/PulseGridSettings';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { SubdivisionCycleButton } from './SubdivisionCycleButton';
import { TapTempoButton } from './TapTempoButton';
import { useHoldRepeatStep } from './useHoldRepeatStep';
import { AnalyticsService } from '../../../services/AnalyticsService';

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

type BpmStepButtonProps = {
  label: string;
  disabled: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  width: number;
  height: number;
  fontSize: number;
  /** Pull the glyph toward the sibling button without changing hit-target size. */
  glyphAlign: 'towardEnd' | 'towardStart';
};

function BpmStepButton({
  label,
  disabled,
  onPressIn,
  onPressOut,
  width,
  height,
  fontSize,
  glyphAlign,
}: BpmStepButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.stepButton,
        {
          width,
          height,
          borderRadius: height / 3,
        },
        glyphAlign === 'towardEnd' ? styles.stepButtonGlyphEnd : styles.stepButtonGlyphStart,
        pressed && !disabled && styles.stepButtonPressed,
        disabled && styles.stepButtonDisabled,
      ]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      // Same stop path if the gesture is cancelled (scroll/ancestor steal).
      onResponderTerminate={onPressOut}
      disabled={disabled}
      accessibilityRole="button"
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
  // Match TapTempoButton height; width is 2× Tap's base size.
  const tapButtonSize = layout.scale(50, 0.05, 0.05);
  const stepButtonHeight = tapButtonSize;
  const stepButtonWidth = tapButtonSize * 1.6;
  const stepFontSize = layout.displayFontSize(26, 0.04, 0.04);
  const stepPairGap = 0;
  const atMin = bpm <= minimumValue;
  const atMax = bpm >= maximumValue;
  const { beginHoldRepeat, stopHoldRepeat, getValue } = useHoldRepeatStep({
    value: bpm,
    minimumValue,
    maximumValue,
    onChange: onBpmChange,
  });

  const bpmAtPressStartRef = useRef(bpm);

  const commitButtonTempo = () => {
    stopHoldRepeat();
    const nextBpm = getValue();
    if (nextBpm !== bpmAtPressStartRef.current) {
      AnalyticsService.logTempoSet(nextBpm, 'buttons');
    }
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
          onPressIn={() => {
            bpmAtPressStartRef.current = getValue();
            beginHoldRepeat(-1);
          }}
          onPressOut={commitButtonTempo}
          width={stepButtonWidth}
          height={stepButtonHeight}
          fontSize={stepFontSize}
          glyphAlign="towardEnd"
        />
        <BpmStepButton
          label="+"
          disabled={atMax}
          onPressIn={() => {
            bpmAtPressStartRef.current = getValue();
            beginHoldRepeat(1);
          }}
          onPressOut={commitButtonTempo}
          width={stepButtonWidth}
          height={stepButtonHeight}
          fontSize={stepFontSize}
          glyphAlign="towardStart"
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
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  stepButtonGlyphEnd: {
    alignItems: 'flex-end',
    paddingRight: 25,
  },
  stepButtonGlyphStart: {
    alignItems: 'flex-start',
    paddingLeft: 25,
  },
  stepButtonPressed: {
    // Light grey press feedback on dark studio slate.
    backgroundColor: 'rgba(148, 163, 184, 0.28)',
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
