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

import { CustomKeyboard } from '../CustomKeyboard';
import { studioColors } from '../../theme';

const MIN_BARS = 1;
const MAX_BARS = 99;

type Props = {
  visible: boolean;
  initialCount: number;
  onCancel: () => void;
  onConfirm: (count: number) => void;
};

function clampCount(value: number): number {
  return Math.min(MAX_BARS, Math.max(MIN_BARS, value));
}

function sanitizeCountInput(text: string): string {
  const digitsOnly = text.replace(/[^\d]/g, '').slice(0, 2);
  if (digitsOnly.length === 0) {
    return '';
  }

  const asNumber = Number(digitsOnly);
  if (!Number.isInteger(asNumber)) {
    return '';
  }

  return String(clampCount(asNumber));
}

function parseCountText(text: string): number | null {
  if (!/^\d+$/.test(text)) {
    return null;
  }
  const value = Number(text);
  if (!Number.isInteger(value)) {
    return null;
  }
  return clampCount(value);
}

/**
 * Compact dialog for editing segment bar count (×N).
 * Same CustomKeyboard pattern as the time-signature picker.
 */
export function CompactBarCountDialog({
  visible,
  initialCount,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const inputRef = useRef<TextInput>(null);

  const [countText, setCountText] = useState(String(clampCount(initialCount)));
  const [keyboardActive, setKeyboardActive] = useState(false);

  useEffect(() => {
    if (visible) {
      setCountText(String(clampCount(initialCount)));
      setKeyboardActive(false);
      return;
    }

    setKeyboardActive(false);
  }, [visible, initialCount]);

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

  const finalizeCount = (): number => {
    const parsed = parseCountText(countText);
    const next = parsed ?? clampCount(initialCount);
    setCountText(String(next));
    return next;
  };

  const handleCancel = () => {
    dismissKeyboard();
    onCancel();
  };

  const handleConfirm = () => {
    const count = finalizeCount();
    dismissKeyboard();
    onConfirm(count);
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
          <Text style={styles.title}>Bar Count</Text>

          <View style={styles.countRow}>
            <Text style={styles.multiply}>×</Text>
            <TextInput
              ref={inputRef}
              style={[styles.countInput, keyboardActive && styles.countInputFocused]}
              value={countText}
              showSoftInputOnFocus={false}
              caretHidden={!keyboardActive}
              disableFullscreenUI
              selectTextOnFocus
              maxLength={2}
              accessibilityLabel="Number of bars"
              onFocus={() => {
                setKeyboardActive(true);
              }}
              onChangeText={(text) => {
                setCountText(sanitizeCountInput(text));
              }}
            />
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
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Apply bar count"
              hitSlop={8}
            >
              <Ionicons name="checkmark" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <CustomKeyboard
          visible={keyboardActive}
          value={countText}
          onChangeText={(text) => {
            setCountText(sanitizeCountInput(text));
          }}
          onDone={() => {
            finalizeCount();
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  multiply: {
    fontSize: 28,
    fontWeight: '700',
    color: studioColors.textPrimary,
    lineHeight: 32,
  },
  countInput: {
    width: 64,
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
  countInputFocused: {
    borderColor: studioColors.accent,
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
