import { memo, useCallback, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { studioColors } from '../../theme';

import type { KeyboardKeyDef, ShiftState } from './keyboardLayouts';
import { resolveKeyLabel } from './keyboardLayouts';

export type KeyboardKeyVariant = 'bottom' | 'right';

type Props = {
  keyDef: KeyboardKeyDef;
  shift: ShiftState;
  variant: KeyboardKeyVariant;
  onPress: (key: KeyboardKeyDef) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Single keyboard key with large touch target and pressed feedback.
 */
export const KeyboardKey = memo(function KeyboardKey({
  keyDef,
  shift,
  variant,
  onPress,
  style,
}: Props) {
  const [pressed, setPressed] = useState(false);
  const pressLock = useRef(false);

  const handlePress = useCallback(() => {
    if (pressLock.current) {
      return;
    }
    pressLock.current = true;
    onPress(keyDef);
    requestAnimationFrame(() => {
      pressLock.current = false;
    });
  }, [keyDef, onPress]);

  const label = resolveKeyLabel(keyDef, shift);
  const isAction =
    keyDef.id === 'mode' ||
    keyDef.id === 'done' ||
    keyDef.id === 'backspace' ||
    keyDef.id === 'space' ||
    keyDef.id === 'shift';
  const isDone = keyDef.id === 'done';
  const isShiftActive = keyDef.id === 'shift' && shift !== 'off';

  return (
    <View style={[{ flex: keyDef.flex ?? 1 }, variant === 'right' && styles.flexFill, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[
          styles.key,
          variant === 'bottom' ? styles.keyBottom : styles.keyRight,
          isAction && styles.actionKey,
          isDone && styles.doneKey,
          isShiftActive && styles.shiftActive,
          pressed && styles.keyPressed,
          pressed && isDone && styles.doneKeyPressed,
        ]}
      >
        <Text
          style={[
            styles.label,
            variant === 'right' && styles.labelRight,
            isAction && styles.actionLabel,
            isDone && styles.doneLabel,
            isShiftActive && styles.shiftActiveLabel,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  flexFill: {
    alignSelf: 'stretch',
  },
  key: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
    paddingHorizontal: 2,
    flex: 1,
  },
  keyBottom: {
    minHeight: 56,
  },
  keyRight: {
    minHeight: 0,
  },
  actionKey: {
    backgroundColor: studioColors.surface,
  },
  doneKey: {
    backgroundColor: studioColors.accent,
    borderColor: studioColors.accent,
  },
  shiftActive: {
    backgroundColor: studioColors.accentMutedBg,
    borderColor: studioColors.accent,
  },
  keyPressed: {
    backgroundColor: studioColors.accentMutedBg,
    borderColor: studioColors.accent,
    opacity: 0.92,
  },
  doneKeyPressed: {
    backgroundColor: '#2B7FD6',
    borderColor: '#2B7FD6',
  },
  label: {
    color: studioColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelRight: {
    fontSize: 18,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: studioColors.textSecondary,
  },
  doneLabel: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  shiftActiveLabel: {
    color: studioColors.accent,
  },
});
