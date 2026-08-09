import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  COUNT_IN_OPTIONS,
  countInOptionLabel,
  type CountInBars,
} from '../../../domain/music/countIn';
import { studioColors } from '../../theme';

type Props = {
  countInBars: CountInBars;
  onChange: (bars: CountInBars) => void;
  disabled?: boolean;
};

/** Timeline-level settings block for the segment editor (not part of the bars list). */
export function TimelinePreparationSection({ countInBars, onChange, disabled = false }: Props) {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.title}>Timeline Settings</Text>
      <Text style={styles.label}>Count-in</Text>
      <View style={styles.row}>
        {COUNT_IN_OPTIONS.map((option) => {
          const selected = countInBars === option;
          const label = countInOptionLabel(option);
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Count-in ${label}`}
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && !disabled && styles.choicePressed,
                disabled && styles.choiceDisabled,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginBottom: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: studioColors.border,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  choice: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  choiceSelected: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.accentMutedBg,
  },
  choicePressed: {
    opacity: 0.8,
  },
  choiceDisabled: {
    opacity: 0.55,
  },
  choiceLabel: {
    fontWeight: '600',
    fontSize: 13,
    color: studioColors.textPrimary,
    textAlign: 'center',
  },
  choiceLabelSelected: {
    color: studioColors.accent,
  },
});
