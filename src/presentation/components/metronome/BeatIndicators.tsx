import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  selectAccentPattern,
  selectCurrentBeat,
  selectIsPlaying,
  selectTimeSignature,
} from '../../../features/metronome/metronomeSelectors';
import { useAppSelector } from '../../../store/hooks';
import { getBeatDotMetrics, useResponsiveLayout } from '../../layout/useResponsiveLayout';
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
  borderWidth: number,
): LedAppearance {
  if (isPlaying) {
    if (isCurrentBeat) {
      const color = isPatternAccent ? studioColors.beatAccent : studioColors.beatActive;

      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        opacity: 1,
      };
    }

    return {
      backgroundColor: studioColors.beatInactivePlaying,
      borderColor: studioColors.beatInactivePlaying,
      borderWidth: 0,
      opacity: studioColors.beatLedRestingOpacity,
    };
  }

  if (isPatternAccent) {
    return {
      backgroundColor: studioColors.beatAccent,
      borderColor: studioColors.beatAccent,
      borderWidth: 0,
      opacity: 1,
    };
  }

  return {
    backgroundColor: 'transparent',
    borderColor: studioColors.beatBorderIdle,
    borderWidth,
    opacity: 1,
  };
}

type BeatLedProps = {
  beatNumber: number;
  size: number;
  isPlaying: boolean;
  isCurrentBeat: boolean;
  isPatternAccent: boolean;
  onPress?: () => void;
};

const BeatLed = memo(function BeatLed({
  beatNumber,
  size,
  isPlaying,
  isCurrentBeat,
  isPatternAccent,
  onPress,
}: BeatLedProps) {
  const borderWidth = Math.max(2, Math.round(size * 0.12));
  const appearance = ledAppearance(isPlaying, isCurrentBeat, isPatternAccent, borderWidth);
  const dotStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: appearance.backgroundColor,
    borderColor: appearance.borderColor,
    borderWidth: appearance.borderWidth,
    opacity: appearance.opacity,
  };

  if (isPlaying) {
    return <View style={[styles.dot, dotStyle]} />;
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
      <View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
});

type BeatIndicatorsProps = {
  onAccentPatternChange: (pattern: boolean[]) => void;
};

function BeatIndicatorsComponent({ onAccentPatternChange }: BeatIndicatorsProps) {
  const isPlaying = useAppSelector(selectIsPlaying);
  const currentBeat = useAppSelector(selectCurrentBeat);
  const accentPattern = useAppSelector(selectAccentPattern);
  const timeSignature = useAppSelector(selectTimeSignature);
  const beatCount = timeSignature.numerator;

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
      {Array.from({ length: beatCount }, (_, index) => (
        <BeatLed
          key={index}
          beatNumber={index + 1}
          size={dotSize}
          isPlaying={isPlaying}
          isCurrentBeat={isPlaying && index === currentBeat}
          isPatternAccent={accentPattern[index] ?? false}
          onPress={() => toggleBeat(index)}
        />
      ))}
    </View>
  );
}

export const BeatIndicators = memo(BeatIndicatorsComponent);

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
