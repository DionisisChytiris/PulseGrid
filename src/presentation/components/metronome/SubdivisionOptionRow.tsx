import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SubdivisionKind } from '../../../domain/valueObjects/Subdivision';
import { studioColors } from '../../theme';
import { SubdivisionIcon } from '../music/SubdivisionIcon';

const OPTIONS: readonly SubdivisionKind[] = ['quarter', 'eighth', 'triplet', 'sixteenth'];

type Props = {
  selected: SubdivisionKind;
  onChange: (subdivision: SubdivisionKind) => void;
};

/**
 * Compact Timeline Builder row matching Quick Metronome subdivision icons.
 * Selection is explicit (not cycled) so all four options are visible at once.
 */
export function SubdivisionOptionRow({ selected, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Subdivision:</Text>
      <View style={styles.options}>
        {OPTIONS.map((kind) => {
          const isSelected = selected === kind;

          return (
            <Pressable
              key={kind}
              onPress={() => onChange(kind)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${kind} subdivision`}
              style={({ pressed }) => [
                styles.option,
                isSelected && styles.optionSelected,
                pressed && styles.optionPressed,
              ]}
            >
              <SubdivisionIcon
                type={kind}
                size={22}
                color={isSelected ? studioColors.accent : studioColors.textPrimary}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.textSecondary,
  },
  options: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  option: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  optionSelected: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.surface,
  },
  optionPressed: {
    opacity: 0.75,
  },
});
