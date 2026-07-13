import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { subdivisionAccentSettingsService } from '../../../application/services/subdivisionAccentSettingsServiceInstance';
import {
  SUBDIVISION_ACCENT_MODE_OPTIONS,
  type SubdivisionAccentModeOption,
} from '../../../domain/metronome/SubdivisionAccentCatalog';
import { SubdivisionAccentMode } from '../../../domain/metronome/SubdivisionAccentMode';
import {
  MAX_SUBDIVISION_ACCENT_EVERY_NTH,
  MIN_SUBDIVISION_ACCENT_EVERY_NTH,
} from '../../../domain/metronome/SubdivisionAccentMode';
import {
  CUSTOM_SUBDIVISION_ACCENT_PATTERN_LENGTH,
  INITIAL_SUBDIVISION_ACCENT_CUSTOM_PATTERN,
  type SubdivisionAccentPattern,
} from '../../../domain/metronome/SubdivisionAccentPattern';
import {
  selectSubdivisionAccentEveryNth,
  selectSubdivisionAccentMode,
  selectSubdivisionAccentPattern,
} from '../../../features/settings/settingsSelectors';
import { useAppSelector } from '../../../store/hooks';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type ModeOptionRowProps = {
  option: SubdivisionAccentModeOption;
  selected: boolean;
  onSelect: () => void;
};

function ModeOptionRow({ option, selected, onSelect }: ModeOptionRowProps) {
  const layout = useResponsiveLayout();
  const disabled = option.comingSoon;

  return (
    <Pressable
      onPress={disabled ? undefined : onSelect}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.optionRow,
        disabled && styles.optionRowDisabled,
        pressed && !disabled && styles.optionPressed,
      ]}
    >
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>

      <View style={styles.optionTextBlock}>
        <Text
          style={[
            styles.optionLabel,
            { fontSize: layout.scale(15) },
            disabled && styles.optionLabelDisabled,
          ]}
        >
          {option.label}
        </Text>
        {option.comingSoon ? (
          <Text style={[styles.comingSoon, { fontSize: layout.scale(12) }]}>Coming soon</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function toEditablePattern(pattern: SubdivisionAccentPattern): boolean[] {
  if (pattern.length === 0) {
    return [...INITIAL_SUBDIVISION_ACCENT_CUSTOM_PATTERN];
  }

  return Array.from(
    { length: CUSTOM_SUBDIVISION_ACCENT_PATTERN_LENGTH },
    (_, index) => pattern[index] ?? false,
  );
}

type PatternToggleProps = {
  accented: boolean;
  index: number;
  onToggle: () => void;
};

function PatternToggle({ accented, index, onToggle }: PatternToggleProps) {
  const layout = useResponsiveLayout();

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected: accented }}
      accessibilityLabel={`Subdivision accent ${index + 1}, ${accented ? 'on' : 'off'}`}
      style={({ pressed }) => [
        styles.patternToggle,
        accented && styles.patternToggleActive,
        pressed && styles.patternTogglePressed,
      ]}
    >
      <Text
        style={[
          styles.patternToggleLabel,
          { fontSize: layout.scale(14) },
          accented && styles.patternToggleLabelActive,
        ]}
      >
        {accented ? 'X' : ''}
      </Text>
    </Pressable>
  );
}

export function SubdivisionAccentSection() {
  const layout = useResponsiveLayout();
  const subdivisionAccentMode = useAppSelector(selectSubdivisionAccentMode);
  const subdivisionAccentEveryNth = useAppSelector(selectSubdivisionAccentEveryNth);
  const subdivisionAccentPattern = useAppSelector(selectSubdivisionAccentPattern);

  const editablePattern = useMemo(
    () => toEditablePattern(subdivisionAccentPattern),
    [subdivisionAccentPattern],
  );

  const onSelect = useCallback((option: SubdivisionAccentModeOption) => {
    if (option.comingSoon) {
      return;
    }

    void subdivisionAccentSettingsService.setSubdivisionAccentMode(option.id);
  }, []);

  const onChangeEveryNth = useCallback(
    (delta: number) => {
      const next = Math.min(
        MAX_SUBDIVISION_ACCENT_EVERY_NTH,
        Math.max(MIN_SUBDIVISION_ACCENT_EVERY_NTH, subdivisionAccentEveryNth + delta),
      );
      void subdivisionAccentSettingsService.setSubdivisionAccentEveryNth(next);
    },
    [subdivisionAccentEveryNth],
  );

  const onTogglePatternStep = useCallback(
    (index: number) => {
      const next = editablePattern.map((accented, stepIndex) =>
        stepIndex === index ? !accented : accented,
      );
      void subdivisionAccentSettingsService.setSubdivisionAccentPattern(next);
    },
    [editablePattern],
  );

  return (
    <View style={[styles.group, { gap: layout.scale(8) }]}>
      <Text style={[styles.groupLabel, { fontSize: layout.scale(13) }]}>Subdivision Accents</Text>
      {SUBDIVISION_ACCENT_MODE_OPTIONS.map((option) => (
        <ModeOptionRow
          key={option.id}
          option={option}
          selected={subdivisionAccentMode === option.id}
          onSelect={() => onSelect(option)}
        />
      ))}

      {subdivisionAccentMode === SubdivisionAccentMode.EVERY_NTH ? (
        <View style={styles.everyNthRow}>
          <Text style={[styles.everyNthLabel, { fontSize: layout.scale(13) }]}>Every Nth</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => onChangeEveryNth(-1)}
              disabled={subdivisionAccentEveryNth <= MIN_SUBDIVISION_ACCENT_EVERY_NTH}
              accessibilityRole="button"
              accessibilityLabel="Decrease every Nth value"
              style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
            >
              <Ionicons name="remove" size={layout.scale(16)} color={studioColors.textPrimary} />
            </Pressable>
            <Text style={[styles.everyNthValue, { fontSize: layout.scale(15) }]}>
              {subdivisionAccentEveryNth}
            </Text>
            <Pressable
              onPress={() => onChangeEveryNth(1)}
              disabled={subdivisionAccentEveryNth >= MAX_SUBDIVISION_ACCENT_EVERY_NTH}
              accessibilityRole="button"
              accessibilityLabel="Increase every Nth value"
              style={({ pressed }) => [styles.stepperButton, pressed && styles.stepperPressed]}
            >
              <Ionicons name="add" size={layout.scale(16)} color={studioColors.textPrimary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {subdivisionAccentMode === SubdivisionAccentMode.CUSTOM ? (
        <View style={styles.patternRow}>
          <Text style={[styles.patternLabel, { fontSize: layout.scale(13) }]}>Pattern</Text>
          <View style={styles.patternToggles}>
            {editablePattern.map((accented, index) => (
              <PatternToggle
                key={index}
                accented={accented}
                index={index}
                onToggle={() => onTogglePatternStep(index)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  group: {
    width: '100%',
    gap: 8,
  },
  groupLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: studioColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  optionRowDisabled: {
    opacity: 0.55,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: studioColors.textPrimary,
    fontWeight: '500',
  },
  optionLabelDisabled: {
    color: studioColors.textSecondary,
  },
  comingSoon: {
    color: studioColors.textMuted,
    fontWeight: '500',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: studioColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: studioColors.accent,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: studioColors.accent,
  },
  everyNthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: studioColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  everyNthLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  stepperPressed: {
    opacity: 0.75,
  },
  everyNthValue: {
    minWidth: 24,
    textAlign: 'center',
    color: studioColors.textPrimary,
    fontWeight: '600',
  },
  patternRow: {
    backgroundColor: studioColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  patternLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
  },
  patternToggles: {
    flexDirection: 'row',
    gap: 8,
  },
  patternToggle: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternToggleActive: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.accentMutedBg,
  },
  patternTogglePressed: {
    opacity: 0.8,
  },
  patternToggleLabel: {
    color: studioColors.textMuted,
    fontWeight: '700',
    minHeight: 18,
  },
  patternToggleLabelActive: {
    color: studioColors.accent,
  },
});
