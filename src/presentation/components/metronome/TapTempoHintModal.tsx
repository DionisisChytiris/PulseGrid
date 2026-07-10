import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type TapTempoHintModalProps = {
  visible: boolean;
  message: string | null;
  onDismiss: () => void;
};

export function TapTempoHintModal({
  visible,
  message,
  onDismiss,
}: TapTempoHintModalProps) {
  const layout = useResponsiveLayout();

  return (
    <Modal
      visible={visible && message !== null}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View
          style={[styles.card, { maxWidth: layout.isTablet ? 400 : 320 }]}
          onStartShouldSetResponder={() => true}
        >
          <Text style={[styles.title, { fontSize: layout.scale(17) }]}>Tap Tempo</Text>
          <Text style={[styles.message, { fontSize: layout.scale(15) }]}>{message}</Text>
          <Pressable
            style={[styles.button, { paddingVertical: layout.scale(12) }]}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss tap tempo help"
          >
            <Text style={[styles.buttonText, { fontSize: layout.scale(16) }]}>Got it</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: studioColors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  title: {
    fontWeight: '600',
    color: studioColors.textPrimary,
    textAlign: 'center',
  },
  message: {
    color: studioColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.accent,
    borderRadius: 10,
    marginTop: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
