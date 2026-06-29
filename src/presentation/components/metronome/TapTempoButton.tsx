import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

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
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  label: {
    color: '#1C1C1E',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  labelAndroid: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  caption: {
    color: '#8E8E93',
    fontWeight: '500',
    textAlign: 'center',
  },
});
