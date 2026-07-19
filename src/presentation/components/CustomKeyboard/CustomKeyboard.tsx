import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { studioColors } from '../../theme';

import { KeyboardRow } from './KeyboardRow';
import {
  layoutForMode,
  resolveInsertChar,
  resolvePlacement,
  type KeyboardKeyDef,
  type KeyboardMode,
  type KeyboardPlacement,
} from './keyboardLayouts';
import { useShiftState } from './useShiftState';

export type CustomKeyboardProps = {
  /** Show or hide the keyboard (animates slide). */
  visible: boolean;
  /** Current text value managed by the parent. */
  value: string;
  /** Called whenever the keyboard mutates the value. */
  onChangeText: (next: string) => void;
  /** Called when Done is pressed. */
  onDone?: () => void;
  /**
   * Keyboard dock placement.
   * - bottom: full-width (portrait)
   * - right: side dock ~40% width (landscape)
   * - auto: bottom in portrait, right in landscape
   */
  placement?: KeyboardPlacement;
  /** Optional initial layout mode. */
  initialMode?: KeyboardMode;
  /** Optional style override for the keyboard container. */
  style?: StyleProp<ViewStyle>;
};

const SLIDE_MS = 220;
/** Landscape side-dock: ~45% of screen, clamped for phones/tablets. */
const RIGHT_WIDTH_RATIO = 0.45;
const RIGHT_WIDTH_MIN = 300;
const RIGHT_WIDTH_MAX = 560;

/**
 * Production-ready in-app keyboard for short PulseGrid text fields.
 * Supports adaptive bottom/right placement, Shift / Caps Lock, and ABC/123.
 */
export function CustomKeyboard({
  visible,
  value,
  onChangeText,
  onDone,
  placement = 'auto',
  initialMode = 'letters',
  style,
}: CustomKeyboardProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const resolvedPlacement = resolvePlacement(placement, width, height);

  const [mode, setMode] = useState<KeyboardMode>(initialMode);
  const [mounted, setMounted] = useState(visible);
  const { shift, toggleShift, consumeOneShotShift, resetShift } = useShiftState();

  const slide = useRef(new Animated.Value(visible ? 0 : 1)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, {
        toValue: 0,
        duration: SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(slide, {
      toValue: 1,
      duration: SLIDE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [slide, visible]);

  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      resetShift();
    }
  }, [initialMode, resetShift, visible]);

  const rows = useMemo(() => layoutForMode(mode), [mode]);

  const rightPanelWidth = Math.min(
    RIGHT_WIDTH_MAX,
    Math.max(RIGHT_WIDTH_MIN, Math.round(width * RIGHT_WIDTH_RATIO)),
  );

  const handleKeyPress = useCallback(
    (key: KeyboardKeyDef) => {
      switch (key.id) {
        case 'char': {
          const ch = resolveInsertChar(key, shift);
          if (ch !== null) {
            onChangeText(value + ch);
            if (/[a-z]/i.test(ch)) {
              consumeOneShotShift();
            }
          }
          break;
        }
        case 'space':
          onChangeText(`${value} `);
          break;
        case 'backspace':
          onChangeText(value.slice(0, -1));
          break;
        case 'mode':
          setMode((current) => (current === 'letters' ? 'numbers' : 'letters'));
          resetShift();
          break;
        case 'shift':
          toggleShift();
          break;
        case 'done':
          onDone?.();
          break;
        default:
          break;
      }
    },
    [
      consumeOneShotShift,
      onChangeText,
      onDone,
      resetShift,
      shift,
      toggleShift,
      value,
    ],
  );

  if (!mounted) {
    return null;
  }

  const isRight = resolvedPlacement === 'right';
  const translate = slide.interpolate({
    inputRange: [0, 1],
    outputRange: isRight ? [0, rightPanelWidth + 24] : [0, 280],
  });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.base,
        isRight
          ? [
              styles.rightDock,
              {
                width: rightPanelWidth,
                paddingTop: Math.max(insets.top, 10),
                paddingBottom: Math.max(insets.bottom, 10),
                paddingLeft: 6,
                paddingRight: Math.max(insets.right, 6),
                transform: [{ translateX: translate }],
              },
            ]
          : [
              styles.bottomDock,
              {
                paddingBottom: Math.max(insets.bottom, 8),
                paddingLeft: Math.max(insets.left, 4),
                paddingRight: Math.max(insets.right, 4),
                transform: [{ translateY: translate }],
              },
            ],
        style,
      ]}
      accessibilityLabel="PulseGrid custom keyboard"
    >
      <View style={[styles.inner, isRight && styles.innerRight]}>
        {rows.map((row, index) => (
          <View
            key={`row-${mode}-${index}`}
            style={[
              index > 0 && (isRight ? styles.rowGapRight : styles.rowGapBottom),
              isRight && styles.rowFlex,
            ]}
          >
            <KeyboardRow
              row={row}
              shift={shift}
              variant={isRight ? 'right' : 'bottom'}
              onKeyPress={handleKeyPress}
            />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    backgroundColor: studioColors.background,
    zIndex: 100,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  bottomDock: {
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: studioColors.border,
    paddingTop: 8,
    shadowOffset: { width: 0, height: -4 },
  },
  rightDock: {
    top: 0,
    bottom: 0,
    right: 0,
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: studioColors.border,
    shadowOffset: { width: -4, height: 0 },
  },
  inner: {
    width: '100%',
    alignSelf: 'stretch',
  },
  innerRight: {
    flex: 1,
    justifyContent: 'space-between',
  },
  rowGapBottom: {
    marginTop: 5,
  },
  rowGapRight: {
    marginTop: 4,
  },
  rowFlex: {
    flex: 1,
  },
});
