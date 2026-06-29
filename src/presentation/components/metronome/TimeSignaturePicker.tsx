import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import type { TimeSignature } from '../../../domain/entities/Metronome';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

export const DEFAULT_TIME_SIGNATURES: TimeSignature[] = [
  { numerator: 2, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 4, denominator: 4 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 8 },
];

const CUSTOM_DENOMINATORS = [2, 4, 8, 16] as const;
const CHIP_GAP = 8;

type TimeSignaturePickerProps = {
  value: TimeSignature;
  onValueChange: (timeSignature: TimeSignature) => void;
  bottomInset?: number;
};

function formatTimeSignature({ numerator, denominator }: TimeSignature): string {
  return `${numerator}/${denominator}`;
}

function timeSignatureKey({ numerator, denominator }: TimeSignature): string {
  return `${numerator}/${denominator}`;
}

function isSameTimeSignature(a: TimeSignature, b: TimeSignature): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

function isDefaultTimeSignature(timeSignature: TimeSignature): boolean {
  return DEFAULT_TIME_SIGNATURES.some((option) => isSameTimeSignature(option, timeSignature));
}

function mergeSignatures(
  defaults: TimeSignature[],
  customs: TimeSignature[],
): TimeSignature[] {
  const merged = [...defaults];

  for (const custom of customs) {
    if (!merged.some((item) => isSameTimeSignature(item, custom))) {
      merged.push(custom);
    }
  }

  return merged;
}

export function TimeSignaturePicker({
  value,
  onValueChange,
  bottomInset = 0,
}: TimeSignaturePickerProps) {
  const layout = useResponsiveLayout();

  const [customSignatures, setCustomSignatures] = useState<TimeSignature[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [draftNumerator, setDraftNumerator] = useState(String(value.numerator));
  const [draftDenominator, setDraftDenominator] = useState(value.denominator);
  const [rowWidth, setRowWidth] = useState(0);

  const signatures = useMemo(
    () => mergeSignatures(DEFAULT_TIME_SIGNATURES, customSignatures),
    [customSignatures],
  );

  const metrics = useMemo(() => {
    const phoneEdgePadding = layout.isCompact ? 8 : -10;
    const rowPaddingHorizontal = layout.isTablet ? 8 : phoneEdgePadding;
    const actionSize = layout.scale(44, 0.08, 0.05);
    const chipGap = layout.isTablet ? CHIP_GAP : 6;
    const rowGap = 4;
    const signatureCount = signatures.length;

    const effectiveRowWidth =
      rowWidth > 0
        ? rowWidth
        : layout.isTablet
          ? layout.contentMaxWidth
          : layout.width;

    const chipsLaneWidth = Math.max(
      0,
      effectiveRowWidth - 2 * actionSize - 2 * rowGap,
    );

    let optionWidth = layout.scale(58, 0.1, 0.1);
    if (!layout.isTablet && signatureCount > 0) {
      optionWidth = Math.max(
        44,
        Math.min(
          52,
          Math.floor((chipsLaneWidth - (signatureCount - 1) * chipGap) / signatureCount),
        ),
      );
    }

    return {
      optionWidth,
      actionSize,
      minusIconSize: layout.scale(22, 0.05, 0.05),
      plusIconSize: layout.scale(22, 0.05, 0.05),
      optionFontSize: layout.scale(16),
      labelFontSize: layout.scale(14),
      modalMaxWidth: layout.isTablet ? 400 : 320,
      rowGap,
      rowPaddingHorizontal,
      chipGap,
      chipsLaneWidth,
      buttonGutter: actionSize + rowGap,
    };
  }, [layout, rowWidth, signatures.length]);

  const chipsContentWidth = useMemo(() => {
    if (signatures.length === 0) {
      return 0;
    }

    return signatures.length * metrics.optionWidth + (signatures.length - 1) * metrics.chipGap;
  }, [metrics.chipGap, metrics.optionWidth, signatures.length]);

  const chipsNeedScroll = chipsContentWidth > metrics.chipsLaneWidth;

  const canDeleteSelected = !isDefaultTimeSignature(value);

  const openCustomModal = () => {
    setDraftNumerator('4');
    setDraftDenominator(4);
    setModalVisible(true);
  };

  const onDraftNumeratorChange = (text: string) => {
    const digits = text.replace(/\D/g, '');

    if (digits === '') {
      setDraftNumerator('');
      return;
    }

    const parsed = Number.parseInt(digits, 10);
    setDraftNumerator(String(Math.min(parsed, 19)));
  };

  const applyCustomTimeSignature = () => {
    const numerator = Number.parseInt(draftNumerator, 10);

    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 19) {
      return;
    }

    const next: TimeSignature = { numerator, denominator: draftDenominator };

    if (!isDefaultTimeSignature(next)) {
      setCustomSignatures((current) => {
        if (current.some((item) => isSameTimeSignature(item, next))) {
          return current;
        }
        return [...current, next];
      });
    }

    onValueChange(next);
    setModalVisible(false);
  };

  const deleteSelectedCustom = () => {
    if (!canDeleteSelected) {
      return;
    }

    setCustomSignatures((current) =>
      current.filter((item) => !isSameTimeSignature(item, value)),
    );
    onValueChange(DEFAULT_TIME_SIGNATURES[2]);
  };

  const chipButtons = signatures.map((option) => {
    const selected = isSameTimeSignature(option, value);
    const label = formatTimeSignature(option);

    return (
      <Pressable
        key={timeSignatureKey(option)}
        style={[
          styles.option,
          {
            width: metrics.optionWidth,
            height: metrics.actionSize,
          },
          selected && styles.optionSelected,
        ]}
        onPress={() => onValueChange(option)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Time signature ${label}`}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.optionText,
            { fontSize: metrics.optionFontSize },
            selected && styles.optionTextSelected,
            Platform.OS === 'android' && styles.optionTextAndroid,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View
      style={[
        styles.container,
        layout.isTablet && styles.containerTablet,
        { paddingBottom: bottomInset + (layout.isTablet ? 0 : layout.isShort ? 16 : 24) },
      ]}
    >
      <View style={styles.labelWrap}>
        <Text
          allowFontScaling={false}
          style={[
            styles.label,
            { fontSize: metrics.labelFontSize },
            Platform.OS === 'android' && styles.labelAndroid,
          ]}
        >
          Time Signature
        </Text>
      </View>

      <View
        style={[
          styles.mobileRow,
          {
            minHeight: metrics.actionSize,
            paddingHorizontal: metrics.rowPaddingHorizontal
          },
        ]}
        onLayout={(event) => setRowWidth(event.nativeEvent.layout.width)}
      >
        <View style={[styles.chipsLane, { paddingHorizontal: metrics.buttonGutter}]}>
          {chipsNeedScroll ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.scrollFill}
              contentContainerStyle={[
                styles.scrollContent,
                { gap: metrics.chipGap, minHeight: metrics.actionSize },
              ]}
            >
              {chipButtons}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.chipsRowCentered,
                { gap: metrics.chipGap, minHeight: metrics.actionSize },
              ]}
            >
              {chipButtons}
            </View>
          )}
        </View>

        <View
          style={[
            styles.sideAbsolute,
            { left: metrics.rowPaddingHorizontal },
            Platform.OS === 'android' && styles.sideSlotAndroid,
          ]}
        >
          <Pressable
            style={[
              styles.deleteButton,
              {
                width: metrics.actionSize,
                height: metrics.actionSize,
              },
              !canDeleteSelected && styles.deleteButtonDisabled,
            ]}
            onPress={deleteSelectedCustom}
            disabled={!canDeleteSelected}
            accessibilityRole="button"
            accessibilityLabel="Delete selected time signature"
            accessibilityState={{ disabled: !canDeleteSelected }}
          >
            <Ionicons
              name="remove"
              size={metrics.minusIconSize}
              color={canDeleteSelected ? '#FFFFFF' : '#8E8E93'}
            />
          </Pressable>
        </View>

        <View
          style={[
            styles.sideAbsolute,
            { right: metrics.rowPaddingHorizontal },
            Platform.OS === 'android' && styles.sideSlotAndroid,
          ]}
        >
          <Pressable
            style={[
              styles.addButton,
              { width: metrics.actionSize, height: metrics.actionSize },
            ]}
            onPress={openCustomModal}
            accessibilityRole="button"
            accessibilityLabel="Create custom time signature"
          >
            <Ionicons name="add" size={metrics.plusIconSize} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxWidth: metrics.modalMaxWidth }]}>
            <Text style={styles.modalTitle}>Custom Time Signature</Text>

            <Text style={styles.fieldLabel}>Beats per bar</Text>
            <TextInput
              style={styles.input}
              value={draftNumerator}
              onChangeText={onDraftNumeratorChange}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />

            <Text style={styles.fieldLabel}>Note value</Text>
            <View style={styles.denominatorRow}>
              {CUSTOM_DENOMINATORS.map((denominator) => {
                const selected = draftDenominator === denominator;

                return (
                  <Pressable
                    key={denominator}
                    style={[styles.denominatorOption, selected && styles.optionSelected]}
                    onPress={() => setDraftDenominator(denominator)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {denominator}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalButtonSecondary} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalButtonPrimary} onPress={applyCustomTimeSignature}>
                <Text style={styles.modalButtonPrimaryText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 20,
    marginTop: 16,
  },
  containerTablet: {
    marginTop: 0,
    gap: 16,
  },
  labelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    width: '100%',
    color: '#8E8E93',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 4,
  },
  labelAndroid: {
    includeFontPadding: false,
  },
  mobileRow: {
    position: 'relative',
    width: '100%',
    justifyContent: 'center',
  },
  chipsLane: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sideAbsolute: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center'
  },
  sideSlotAndroid: {
    zIndex: 2,
    elevation: 2,
  },
  deleteButton: {
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  deleteButtonDisabled: {
    backgroundColor: '#E5E5EA',
    opacity: 0.5,
  },
  scrollFill: {
    width: '100%',
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  option: {
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionSelected: {
    backgroundColor: '#007AFF',
  },
  optionText: {
    fontWeight: '500',
    color: '#000000',
    textAlign: 'center',
  },
  optionTextAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 18,
    textAlign: 'center',
  },
  denominatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  denominatorOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    minWidth: 44,
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButtonSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  modalButtonPrimary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
