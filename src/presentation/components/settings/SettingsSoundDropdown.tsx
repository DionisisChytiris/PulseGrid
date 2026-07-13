import { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

export type SettingsSoundOption<T extends string> = {
  readonly id: T;
  readonly label: string;
};

type SettingsSoundDropdownProps<T extends string> = {
  label: string;
  value: T;
  options: readonly SettingsSoundOption<T>[];
  onValueChange: (value: T) => void;
  onPreview?: (value: T) => void;
};

export function SettingsSoundDropdown<T extends string>({
  label,
  value,
  options,
  onValueChange,
  onPreview,
}: SettingsSoundDropdownProps<T>) {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option.id === value)?.label ?? value,
    [options, value],
  );

  const close = useCallback(() => setOpen(false), []);

  const onSelect = useCallback(
    (nextValue: T) => {
      close();
      if (nextValue !== value) {
        onValueChange(nextValue);
      }
    },
    [close, onValueChange, value],
  );

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { fontSize: layout.scale(13) }]}>{label}</Text>

      <View style={styles.controlRow}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${selectedLabel}`}
          style={({ pressed }) => [styles.dropdown, pressed && styles.dropdownPressed]}
        >
          <Text style={[styles.dropdownValue, { fontSize: layout.scale(15) }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Ionicons name="chevron-down" size={layout.scale(16)} color={studioColors.textMuted} />
        </Pressable>

        {onPreview ? (
          <Pressable
            onPress={() => onPreview(value)}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${label}`}
            hitSlop={8}
            style={({ pressed }) => [styles.previewButton, pressed && styles.previewPressed]}
          >
            <Ionicons name="play" size={layout.scale(14)} color={studioColors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View
            style={[
              styles.sheet,
              {
                marginBottom: insets.bottom + 16,
                marginHorizontal: layout.horizontalPadding,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { fontSize: layout.scale(16) }]}>{label}</Text>
            <ScrollView bounces={false}>
              {options.map((option) => {
                const selected = option.id === value;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => onSelect(option.id)}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.optionRow,
                      selected && styles.optionRowSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        { fontSize: layout.scale(15) },
                        selected && styles.optionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={layout.scale(18)} color={studioColors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: studioColors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: studioColors.surface,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  dropdownPressed: {
    opacity: 0.85,
  },
  dropdownValue: {
    flex: 1,
    color: studioColors.textPrimary,
    fontWeight: '500',
    marginRight: 8,
  },
  previewButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  previewPressed: {
    opacity: 0.75,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingTop: 16,
    paddingBottom: 8,
    maxHeight: '70%',
  },
  sheetTitle: {
    color: studioColors.textPrimary,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionRowSelected: {
    backgroundColor: studioColors.surface,
  },
  optionPressed: {
    opacity: 0.85,
  },
  optionLabel: {
    color: studioColors.textPrimary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: studioColors.accent,
  },
});
