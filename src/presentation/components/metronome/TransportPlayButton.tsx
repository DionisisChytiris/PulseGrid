import { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type TransportPlayButtonProps = {
  isPlaying: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const PRESS_SCALE = 0.96;
const PRESS_OPACITY = 0.92;

export function TransportPlayButton({ isPlaying, onPress, style }: TransportPlayButtonProps) {
  const layout = useResponsiveLayout();
  const scale = useRef(new Animated.Value(1)).current;
  const pressOpacity = useRef(new Animated.Value(1)).current;

  const buttonWidth = layout.scale(124, 0.08, 0.06);
  const buttonHeight = layout.scale(46, 0.08, 0.06);
  const borderRadius = layout.scale(14, 0.05, 0.05);
  const iconSize = layout.scale(20, 0.06, 0.05);

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        useNativeDriver: true,
        speed: 28,
        bounciness: 0,
      }),
      Animated.timing(pressOpacity, {
        toValue: toOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressIn = () => {
    animateTo(PRESS_SCALE, PRESS_OPACITY);
  };

  const handlePressOut = () => {
    animateTo(1, 1);
  };

  const tintStyle = isPlaying ? styles.stopTint : styles.playTint;

  return (
    <Animated.View
      style={[
        styles.shadow,
        {
          borderRadius,
          opacity: pressOpacity,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Stop metronome' : 'Start metronome'}
        style={[
          styles.button,
          tintStyle,
          {
            width: buttonWidth,
            height: buttonHeight,
            borderRadius,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.glassHighlight,
            {
              borderTopLeftRadius: borderRadius,
              borderTopRightRadius: borderRadius,
            },
          ]}
        />
        <Ionicons
          name={isPlaying ? 'stop' : 'play'}
          size={iconSize}
          color={studioColors.transportIcon}
          style={!isPlaying && styles.playIconOffset}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...Platform.select({
      ios: {
        shadowColor: studioColors.transportShadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
      default: {},
    }),
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: studioColors.transportGlassBase,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.transportGlassBorder,
  },
  playTint: {
    backgroundColor: studioColors.transportPlayTint,
  },
  stopTint: {
    backgroundColor: studioColors.transportStopTint,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: studioColors.transportGlassHighlight,
  },
  playIconOffset: {
    marginLeft: 2,
  },
});
