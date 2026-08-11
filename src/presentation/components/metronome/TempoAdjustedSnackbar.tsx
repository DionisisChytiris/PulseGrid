import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { studioColors } from '../../theme';

type Props = {
  visible: boolean;
  message: string;
  onHide: () => void;
  /** Visible duration in ms. Default 2000. */
  durationMs?: number;
};

/**
 * Lightweight bottom snackbar for automatic tempo adjustments.
 * Not a modal — pointer-events none so it never blocks the dial.
 */
export function TempoAdjustedSnackbar({
  visible,
  message,
  onHide,
  durationMs = 2000,
}: Props) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    const timeoutId = setTimeout(onHide, durationMs);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [visible, durationMs, onHide, message]);

  if (!visible || message.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.host}>
      <View style={styles.snack}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 96,
    zIndex: 50,
  },
  snack: {
    maxWidth: 360,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.borderSubtle,
  },
  text: {
    color: studioColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
