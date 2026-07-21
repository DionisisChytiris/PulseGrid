import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  selectAccentPattern,
  selectCurrentBeat,
  selectIsPlaying,
  selectTimeSignature,
} from '../../../features/metronome/metronomeSelectors';
import { useAppSelector } from '../../../store/hooks';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type LedAppearance = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
};

function ledAppearance(
  isPlaying: boolean,
  isCurrentBeat: boolean,
  isPatternAccent: boolean,
  isBeatOne: boolean,
): LedAppearance {
  if (isPlaying) {
    if (isCurrentBeat) {
      const color = isPatternAccent || isBeatOne ? studioColors.beatAccent : studioColors.beatActive;

      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        opacity: 1,
      };
    }

    return {
      backgroundColor: isBeatOne ? studioColors.beatActive : studioColors.beatInactivePlaying,
      borderColor: isBeatOne ? studioColors.beatActive : studioColors.beatInactivePlaying,
      borderWidth: 0,
      opacity: isBeatOne ? 0.55 : studioColors.beatLedRestingOpacity,
    };
  }

  if (isPatternAccent || isBeatOne) {
    return {
      backgroundColor: studioColors.beatAccent,
      borderColor: studioColors.beatAccent,
      borderWidth: 0,
      opacity: 1,
    };
  }

  // Unaccented idle: filled light blue, no border outline.
  return {
    backgroundColor: '#7EB6E8',
    borderColor: 'transparent',
    borderWidth: 0,
    opacity: 0.85,
  };
}

type ClockBeatDotProps = {
  beatNumber: number;
  size: number;
  left: number;
  top: number;
  isPlaying: boolean;
  isCurrentBeat: boolean;
  isPatternAccent: boolean;
  onPress?: () => void;
};

const ClockBeatDot = memo(function ClockBeatDot({
  beatNumber,
  size,
  left,
  top,
  isPlaying,
  isCurrentBeat,
  isPatternAccent,
  onPress,
}: ClockBeatDotProps) {
  const isBeatOne = beatNumber === 1;
  const appearance = ledAppearance(isPlaying, isCurrentBeat, isPatternAccent, isBeatOne);
  const dotStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: appearance.backgroundColor,
    borderColor: appearance.borderColor,
    borderWidth: appearance.borderWidth,
    opacity: appearance.opacity,
  };

  const positionStyle = {
    position: 'absolute' as const,
    left,
    top,
  };

  if (isPlaying) {
    return (
      <View style={positionStyle} pointerEvents="none">
        <View style={[styles.dot, dotStyle]} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Beat ${beatNumber}, ${isPatternAccent ? 'accented' : 'normal'}`}
      accessibilityHint="Double tap to toggle accent"
      accessibilityState={{ selected: isPatternAccent }}
      style={({ pressed }) => [positionStyle, pressed && styles.dotPressed]}
    >
      <View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
});

type ClockBeatIndicatorsProps = {
  /** Outer diameter of the tempo ring (visual ring, not touch pad). */
  diameter: number;
  strokeWidth: number;
  onAccentPatternChange: (pattern: boolean[]) => void;
};

/**
 * Clock-face beat indicators around the BPM circle.
 * Beat 1 is always at 12 o'clock; remaining beats are equally spaced clockwise.
 */
function ClockBeatIndicatorsComponent({
  diameter,
  strokeWidth,
  onAccentPatternChange,
}: ClockBeatIndicatorsProps) {
  const isPlaying = useAppSelector(selectIsPlaying);
  const currentBeat = useAppSelector(selectCurrentBeat);
  const accentPattern = useAppSelector(selectAccentPattern);
  const timeSignature = useAppSelector(selectTimeSignature);
  const beatCount = timeSignature.numerator;

  const layout = useResponsiveLayout();
  const baseDotSize = layout.scale(20, 0.05, 0.05);
  const beatOneSize = Math.round(baseDotSize * 1.25);
  const orbitRadius = diameter / 2 + strokeWidth * 0.55 + baseDotSize * 1.25;
  const center = diameter / 2;

  const positions = useMemo(() => {
    if (beatCount <= 0) {
      return [];
    }

    return Array.from({ length: beatCount }, (_, beatIndex) => {
      const angle = -Math.PI / 2 + (beatIndex / beatCount) * Math.PI * 2;
      const size = beatIndex === 0 ? beatOneSize : baseDotSize;
      const x = center + orbitRadius * Math.cos(angle);
      const y = center + orbitRadius * Math.sin(angle);

      return {
        beatIndex,
        size,
        left: x - size / 2,
        top: y - size / 2,
      };
    });
  }, [baseDotSize, beatCount, beatOneSize, center, orbitRadius]);

  const toggleBeat = (beatIndex: number) => {
    const next = accentPattern.map((accent, index) =>
      index === beatIndex ? !accent : accent,
    );
    onAccentPatternChange([...next]);
  };

  if (beatCount <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.orbit, { width: diameter, height: diameter }]}
      accessibilityLabel={isPlaying ? 'Beat indicators' : 'Beat indicators, tap to set accents'}
    >
      {positions.map(({ beatIndex, size, left, top }) => (
        <ClockBeatDot
          key={beatIndex}
          beatNumber={beatIndex + 1}
          size={size}
          left={left}
          top={top}
          isPlaying={isPlaying}
          isCurrentBeat={isPlaying && beatIndex === currentBeat}
          isPatternAccent={accentPattern[beatIndex] ?? false}
          onPress={() => toggleBeat(beatIndex)}
        />
      ))}
    </View>
  );
}

export const ClockBeatIndicators = memo(ClockBeatIndicatorsComponent);

const styles = StyleSheet.create({
  orbit: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPressed: {
    opacity: 0.7,
  },
});
