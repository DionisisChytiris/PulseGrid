import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { BpmCircularSlider } from './BpmCircularSlider';

type BpmControlProps = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (value: number) => void;
};

function clampBpm(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

export function BpmControl({
  value,
  minimumValue,
  maximumValue,
  onValueChange,
}: BpmControlProps) {
  const layout = useResponsiveLayout();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<TextInput>(null);

  const metrics = useMemo(() => {
    const bpmFontSize = layout.displayFontSize(56, 0.08, 0.12);

    return {
      bpmFontSize,
      bpmLineHeight: Math.round(bpmFontSize * 1.05),
      stepButtonSize: layout.scale(48, 0.08, 0.08),
      stepFontSize: layout.displayFontSize(28, 0.05, 0.05),
      bpmMinWidth: layout.scale(96, 0.05, 0.1),
      maxWidth: layout.contentMaxWidth,
    };
  }, [layout]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(String(value));
    }
  }, [isEditing, value]);

  const commitDraft = () => {
    const parsed = Number.parseInt(draft, 10);

    if (!Number.isNaN(parsed)) {
      const next = clampBpm(parsed, minimumValue, maximumValue);
      onValueChange(next);
      setDraft(String(next));
    } else {
      setDraft(String(value));
    }

    setIsEditing(false);
    Keyboard.dismiss();
  };

  const adjustBpm = (delta: number) => {
    const next = clampBpm(value + delta, minimumValue, maximumValue);
    onValueChange(next);
  };

  const startEditing = () => {
    setDraft(String(value));
    setIsEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const atMin = value <= minimumValue;
  const atMax = value >= maximumValue;

  return (
    <View style={[styles.container, { maxWidth: metrics.maxWidth }]}>
      <View style={styles.bpmRow}>
        <Pressable
          style={[
            styles.stepButton,
            {
              width: metrics.stepButtonSize,
              height: metrics.stepButtonSize,
              borderRadius: metrics.stepButtonSize / 2,
            },
            atMin && styles.stepButtonDisabled,
          ]}
          onPress={() => adjustBpm(-1)}
          disabled={atMin}
          accessibilityLabel="Decrease BPM"
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.stepButtonText,
              { fontSize: metrics.stepFontSize, lineHeight: metrics.stepFontSize + 4 },
              atMin && styles.stepButtonTextDisabled,
            ]}
          >
            −
          </Text>
        </Pressable>

        <BpmCircularSlider
          value={value}
          minimumValue={minimumValue}
          maximumValue={maximumValue}
          onValueChange={onValueChange}
        >
          <Pressable
            style={styles.bpmDisplay}
            onPress={startEditing}
            accessibilityLabel="Edit BPM"
          >
            {isEditing ? (
              <TextInput
                ref={inputRef}
                allowFontScaling={false}
                style={[
                  styles.bpmInput,
                  {
                    fontSize: metrics.bpmFontSize,
                    lineHeight: metrics.bpmLineHeight,
                    minWidth: metrics.bpmMinWidth,
                  },
                  Platform.OS === 'android' && styles.bpmTextAndroid,
                ]}
                value={draft}
                onChangeText={setDraft}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={3}
                selectTextOnFocus
                onSubmitEditing={commitDraft}
                onBlur={commitDraft}
              />
            ) : (
              <Text
                allowFontScaling={false}
                style={[
                  styles.bpmValue,
                  {
                    fontSize: metrics.bpmFontSize,
                    lineHeight: metrics.bpmLineHeight,
                  },
                  Platform.OS === 'android' && styles.bpmTextAndroid,
                ]}
              >
                {value}
              </Text>
            )}
            <Text style={[styles.bpmLabel, { fontSize: layout.scale(14) }]}>BPM</Text>
          </Pressable>
        </BpmCircularSlider>

        <Pressable
          style={[
            styles.stepButton,
            {
              width: metrics.stepButtonSize,
              height: metrics.stepButtonSize,
              borderRadius: metrics.stepButtonSize / 2,
            },
            atMax && styles.stepButtonDisabled,
          ]}
          onPress={() => adjustBpm(1)}
          disabled={atMax}
          accessibilityLabel="Increase BPM"
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.stepButtonText,
              { fontSize: metrics.stepFontSize, lineHeight: metrics.stepFontSize + 4 },
              atMax && styles.stepButtonTextDisabled,
            ]}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
  bpmDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bpmValue: {
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'center',
  },
  bpmInput: {
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'center',
    padding: 0,
  },
  bpmTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  bpmLabel: {
    color: studioColors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
