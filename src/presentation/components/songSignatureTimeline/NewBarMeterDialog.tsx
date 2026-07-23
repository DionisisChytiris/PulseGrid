import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createMeter, type Meter } from '../../../domain/music/Meter';
import { CustomKeyboard } from '../../components/CustomKeyboard';
import { studioColors } from '../../theme';

import {
  clampNumerator,
  METER_DENOMINATORS,
  normalizeDenominator,
  parseNumeratorText,
  sanitizeNumeratorInput,
  type MeterDenominator,
} from './meterPickerValidation';

type Props = {
  visible: boolean;
  /** Dialog title. Defaults to "New Bar". */
  title?: string;
  /** Seed values when the dialog opens. Defaults to 4/4. */
  initialMeter?: Meter;
  /** Accessibility label for the confirm button. */
  confirmAccessibilityLabel?: string;
  /** Confirm icon — add for new bar, checkmark when applying an edit. */
  confirmIcon?: 'add' | 'checkmark';
  onCancel: () => void;
  onConfirm: (meter: Meter) => void;
};

/**
 * Compact time-signature picker (CustomKeyboard, no system keyboard).
 * Used by New Bar — isolated so future fields can share it.
 */
export function NewBarMeterDialog({
  visible,
  title = 'New Bar',
  initialMeter,
  confirmAccessibilityLabel = 'Add Bar',
  confirmIcon = 'add',
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const inputRef = useRef<TextInput>(null);

  const [numeratorText, setNumeratorText] = useState('4');
  const [denominator, setDenominator] = useState<MeterDenominator>(4);
  const [keyboardActive, setKeyboardActive] = useState(false);

  useEffect(() => {
    if (visible) {
      const numerator = initialMeter?.numerator ?? 4;
      const denom = normalizeDenominator(initialMeter?.denominator ?? 4);
      setNumeratorText(String(clampNumerator(numerator)));
      setDenominator(denom);
      setKeyboardActive(false);
      return;
    }

    setKeyboardActive(false);
    // Seed only when the dialog opens; ignore identity changes of initialMeter while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [visible]);

  const panelMaxWidth = useMemo(
    () => (landscape ? Math.min(280, width * 0.55) : Math.min(260, width * 0.78)),
    [landscape, width],
  );

  const dismissKeyboard = () => {
    setKeyboardActive(false);
    requestAnimationFrame(() => {
      inputRef.current?.blur();
    });
  };

  const finalizeNumerator = (): number => {
    const parsed = parseNumeratorText(numeratorText);
    const next = parsed ?? 4;
    setNumeratorText(String(next));
    return next;
  };

  const handleCancel = () => {
    dismissKeyboard();
    onCancel();
  };

  const handleAdd = () => {
    const numerator = finalizeNumerator();
    dismissKeyboard();
    onConfirm(createMeter(numerator, denominator));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      // RN Modal defaults to portrait-only on iOS — keep Song Editor landscape lock.
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleCancel} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.panel,
            {
              maxWidth: panelMaxWidth,
              marginBottom: Math.max(insets.bottom, 8),
              marginTop: Math.max(insets.top, 8),
              marginRight: landscape && keyboardActive ? Math.round(width * 0.45) : 0,
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>

          <View style={styles.meterRow}>
            <TextInput
              ref={inputRef}
              style={[styles.numeratorInput, keyboardActive && styles.numeratorInputFocused]}
              value={numeratorText}
              showSoftInputOnFocus={false}
              caretHidden={!keyboardActive}
              disableFullscreenUI
              selectTextOnFocus
              maxLength={2}
              accessibilityLabel="Beats per bar"
              onFocus={() => {
                setKeyboardActive(true);
              }}
              onChangeText={(text) => {
                setNumeratorText(sanitizeNumeratorInput(text));
              }}
            />

            <Text style={styles.slash}>/</Text>

            <View style={styles.denominatorRow}>
              {METER_DENOMINATORS.map((value) => {
                const selected = value === denominator;
                return (
                  <Pressable
                    key={value}
                    style={[styles.denominatorChip, selected && styles.denominatorChipSelected]}
                    onPress={() => setDenominator(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Denominator ${value}`}
                  >
                    <Text
                      style={[
                        styles.denominatorText,
                        selected && styles.denominatorTextSelected,
                      ]}
                    >
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.iconButton, styles.iconButtonCancel]}
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color="#FF4D4F" />
            </Pressable>
            <Pressable
              style={[styles.iconButton, styles.iconButtonPrimary]}
              onPress={handleAdd}
              accessibilityRole="button"
              accessibilityLabel={confirmAccessibilityLabel}
              hitSlop={8}
            >
              <Ionicons name={confirmIcon} size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <CustomKeyboard
          visible={keyboardActive}
          value={numeratorText}
          onChangeText={(text) => {
            setNumeratorText(sanitizeNumeratorInput(text));
          }}
          onDone={() => {
            finalizeNumerator();
            dismissKeyboard();
          }}
          placement="auto"
          initialMode="numbers"
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  panel: {
    width: '100%',
    backgroundColor: studioColors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: studioColors.textPrimary,
    textAlign: 'center',
  },
  meterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  numeratorInput: {
    width: 52,
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  numeratorInputFocused: {
    borderColor: studioColors.accent,
  },
  slash: {
    fontSize: 28,
    fontWeight: '700',
    color: studioColors.textPrimary,
    lineHeight: 32,
  },
  denominatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  denominatorChip: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  denominatorChipSelected: {
    backgroundColor: studioColors.accent,
    borderColor: studioColors.accent,
  },
  denominatorText: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
  },
  denominatorTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonCancel: {
    backgroundColor: studioColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 77, 79, 0.45)',
  },
  iconButtonPrimary: {
    backgroundColor: studioColors.accent,
  },
});
