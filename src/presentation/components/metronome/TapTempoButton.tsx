import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type TapTempoButtonProps = {
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
};

export function TapTempoButton({
  onPress,
  onLongPress,
  disabled = false,
}: TapTempoButtonProps) {
  const layout = useResponsiveLayout();
  const buttonSize = layout.scale(32, 0.05, 0.05);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Tap tempo"
        accessibilityHint="Tap repeatedly to set BPM. Long press for help."
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.button,
          {
            minWidth: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            paddingHorizontal: layout.scale(8),
          },
          disabled && styles.buttonDisabled,
          pressed && !disabled && styles.buttonPressed,
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[
            styles.label,
            { fontSize: layout.scale(11) },
            Platform.OS === 'android' && styles.labelAndroid,
          ]}
        >
          TAP
        </Text>
      </Pressable>
      <Text
        allowFontScaling={false}
        style={[styles.caption, { fontSize: layout.scale(10), marginTop: layout.scale(4) }]}
      >
        Set tempo
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  label: {
    color: studioColors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  caption: {
    color: studioColors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
});
