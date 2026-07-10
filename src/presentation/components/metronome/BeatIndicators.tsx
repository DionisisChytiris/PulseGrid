import { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { studioColors } from '../../theme';
import { getBeatDotMetrics, useResponsiveLayout } from '../../layout/useResponsiveLayout';

type DotStyle = {
  backgroundColor: string;
  borderWidth: number;
  borderColor: string;
};

function useDotStyle(
  isPlaying: boolean,
  isCurrentBeat: boolean,
  isSubdivisionTick: boolean,
  isCurrentAccent: boolean,
  isPatternAccent: boolean,
  borderWidth: number,
): DotStyle {
  return useMemo(() => {
    if (isPlaying) {
      if (isCurrentBeat) {
        if (isSubdivisionTick) {
          return {
            backgroundColor: studioColors.beatSubdivision,
            borderWidth: 0,
            borderColor: studioColors.beatSubdivision,
          };
        }

        const backgroundColor = isCurrentAccent ? studioColors.beatAccent : studioColors.beatActive;

        return {
          backgroundColor,
          borderWidth: 0,
          borderColor: backgroundColor,
        };
      }

      return {
        backgroundColor: studioColors.beatInactivePlaying,
        borderWidth: 0,
        borderColor: studioColors.beatInactivePlaying,
      };
    }

    if (isPatternAccent) {
      return {
        backgroundColor: studioColors.beatAccent,
        borderWidth,
        borderColor: studioColors.beatAccent,
      };
    }

    return {
      backgroundColor: 'transparent',
      borderWidth,
      borderColor: studioColors.beatBorderIdle,
    };
  }, [
    borderWidth,
    isCurrentAccent,
    isCurrentBeat,
    isPatternAccent,
    isPlaying,
    isSubdivisionTick,
  ]);
}

type PlayingBeatDotProps = {
  size: number;
  isPrimaryTick: boolean;
  isSubdivisionTick: boolean;
  dotStyle: DotStyle;
};

function PlayingBeatDot({
  size,
  isPrimaryTick,
  isSubdivisionTick,
  dotStyle,
}: PlayingBeatDotProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const targetScale = isPrimaryTick ? 1.5 : isSubdivisionTick ? 1.2 : 1;

    Animated.timing(scale, {
      toValue: targetScale,
      duration: isPrimaryTick || isSubdivisionTick ? 60 : 100,
      useNativeDriver: true,
    }).start();
  }, [isPrimaryTick, isSubdivisionTick, scale]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          transform: [{ scale }],
        },
        dotStyle,
      ]}
    />
  );
}

type BeatDotProps = {
  beatNumber: number;
  size: number;
  isPlaying: boolean;
  isCurrentBeat: boolean;
  isPrimaryTick: boolean;
  isSubdivisionTick: boolean;
  isCurrentAccent: boolean;
  isPatternAccent: boolean;
  onPress?: () => void;
};

function BeatDot({
  beatNumber,
  size,
  isPlaying,
  isCurrentBeat,
  isPrimaryTick,
  isSubdivisionTick,
  isCurrentAccent,
  isPatternAccent,
  onPress,
}: BeatDotProps) {
  const borderWidth = Math.max(2, Math.round(size * 0.12));
  const dotStyle = useDotStyle(
    isPlaying,
    isCurrentBeat,
    isSubdivisionTick,
    isCurrentAccent,
    isPatternAccent,
    borderWidth,
  );
  const dotDimensions = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (isPlaying) {
    return (
      <PlayingBeatDot
        size={size}
        isPrimaryTick={isPrimaryTick}
        isSubdivisionTick={isSubdivisionTick}
        dotStyle={dotStyle}
      />
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`Beat ${beatNumber}, ${isPatternAccent ? 'accented' : 'normal'}`}
      accessibilityHint="Double tap to toggle accent"
      accessibilityState={{ selected: isPatternAccent }}
      style={({ pressed }) => pressed && styles.dotPressed}
    >
      <View style={[styles.dot, dotDimensions, dotStyle]} />
    </Pressable>
  );
}

type BeatIndicatorsProps = {
  beatCount: number;
  accentPattern: readonly boolean[];
  currentBeat: number;
  currentSubdivisionIndex: number;
  isAccent: boolean;
  isPlaying: boolean;
  onAccentPatternChange: (pattern: boolean[]) => void;
};

export function BeatIndicators({
  beatCount,
  accentPattern,
  currentBeat,
  currentSubdivisionIndex,
  isAccent,
  isPlaying,
  onAccentPatternChange,
}: BeatIndicatorsProps) {
  const layout = useResponsiveLayout();
  const { dotSize, gap, minHeight } = useMemo(
    () => getBeatDotMetrics(beatCount, layout),
    [beatCount, layout],
  );

  const toggleBeat = (beatIndex: number) => {
    const next = accentPattern.map((accent, index) =>
      index === beatIndex ? !accent : accent,
    );
    onAccentPatternChange([...next]);
  };

  return (
    <View
      style={[styles.row, { gap, minHeight, maxWidth: '100%' }]}
      accessibilityLabel={isPlaying ? 'Beat indicators' : 'Beat indicators, tap to set accents'}
    >
      {Array.from({ length: beatCount }, (_, index) => {
        const isCurrentBeat = isPlaying && index === currentBeat;
        const isPrimaryTick = isCurrentBeat && currentSubdivisionIndex === 0;
        const isSubdivisionTick = isCurrentBeat && currentSubdivisionIndex > 0;

        return (
          <BeatDot
            key={index}
            beatNumber={index + 1}
            size={dotSize}
            isPlaying={isPlaying}
            isCurrentBeat={isCurrentBeat}
            isPrimaryTick={isPrimaryTick}
            isSubdivisionTick={isSubdivisionTick}
            isCurrentAccent={isPrimaryTick && isAccent}
            isPatternAccent={accentPattern[index] ?? false}
            onPress={() => toggleBeat(index)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    paddingHorizontal: 4,
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPressed: {
    opacity: 0.7,
  },
});
