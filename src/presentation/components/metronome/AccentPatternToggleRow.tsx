import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { beatLedAppearance } from './beatLedAppearance';

type BeatLedProps = {
  beatNumber: number;
  size: number;
  /** Minimum pressable area; visual dot stays `size`. */
  touchSize: number;
  isPlaying: boolean;
  isCurrentBeat: boolean;
  isPatternAccent: boolean;
  onPress?: () => void;
};

const BeatLed = memo(function BeatLed({
  beatNumber,
  size,
  touchSize,
  isPlaying,
  isCurrentBeat,
  isPatternAccent,
  onPress,
}: BeatLedProps) {
  const borderWidth = Math.max(2, Math.round(size * 0.12));
  const appearance = beatLedAppearance(isPlaying, isCurrentBeat, isPatternAccent, borderWidth);
  const dotStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: appearance.backgroundColor,
    borderColor: appearance.borderColor,
    borderWidth: appearance.borderWidth,
    opacity: appearance.opacity,
  };
  const touchStyle = {
    width: touchSize,
    height: touchSize,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  if (isPlaying || onPress === undefined) {
    return (
      <View style={touchStyle}>
        <View style={[styles.dot, dotStyle]} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Beat ${beatNumber}, ${isPatternAccent ? 'accented' : 'normal'}`}
      accessibilityHint="Double tap to toggle accent"
      accessibilityState={{ selected: isPatternAccent }}
      style={({ pressed }) => [touchStyle, pressed && styles.dotPressed]}
    >
      <View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
});

export type AccentPatternToggleRowProps = {
  pattern: readonly boolean[];
  onChange: (pattern: boolean[]) => void;
  /** Dot diameter in px. */
  size?: number;
  gap?: number;
  /** Minimum tap target per beat (default: visual size). */
  minTouchSize?: number;
  isPlaying?: boolean;
  currentBeat?: number;
  /** When false, beats are display-only (no tap-to-toggle). */
  editable?: boolean;
};

/**
 * Controlled accent-pattern row shared by Quick Metronome and Song segment editor.
 * Tap a beat (when idle) to toggle accent — same interaction on both screens.
 */
export const AccentPatternToggleRow = memo(function AccentPatternToggleRow({
  pattern,
  onChange,
  size = 18,
  gap = 6,
  minTouchSize,
  isPlaying = false,
  currentBeat = -1,
  editable = true,
}: AccentPatternToggleRowProps) {
  const beatCount = pattern.length;
  const touchSize = Math.max(size, minTouchSize ?? size);

  const toggleBeat = (beatIndex: number) => {
    const next = pattern.map((accent, index) => (index === beatIndex ? !accent : accent));
    onChange([...next]);
  };

  return (
    <View
      style={[styles.row, { gap }]}
      accessibilityLabel={
        isPlaying || !editable
          ? 'Beat accents'
          : 'Beat accents, tap to set accents'
      }
    >
      {Array.from({ length: beatCount }, (_, index) => (
        <BeatLed
          key={index}
          beatNumber={index + 1}
          size={size}
          touchSize={touchSize}
          isPlaying={isPlaying}
          isCurrentBeat={isPlaying && index === currentBeat}
          isPatternAccent={pattern[index] ?? false}
          onPress={editable && !isPlaying ? () => toggleBeat(index) : undefined}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPressed: {
    opacity: 0.7,
  },
});
