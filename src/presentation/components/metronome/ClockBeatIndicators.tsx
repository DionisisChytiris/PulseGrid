import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { clickSoundService } from '../../../application/services/clickSoundServiceInstance';
import {
  selectAccentPattern,
  selectIsPlaying,
  selectTimeSignature,
} from '../../../features/metronome/metronomeSelectors';
import { selectBarStartEnabled } from '../../../features/settings/settingsSelectors';
import { useAppSelector } from '../../../store/hooks';
import { useBeatFlashPulse } from '../../hooks/useBeatFlashPulse';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';

type LedAppearance = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
};

/**
 * Beat-dot colours. Three states only: Bar, Accent, Click.
 * Beat 1 never uses the accent pattern — Bar when enabled, Click when disabled.
 */
function ledAppearance(
  isPlaying: boolean,
  isCurrentBeat: boolean,
  isPatternAccent: boolean,
  isBarStartBeat: boolean,
): LedAppearance {
  if (isPlaying) {
    if (isCurrentBeat) {
      const color =
        isBarStartBeat || isPatternAccent ? studioColors.beatAccent : studioColors.beatActive;

      return {
        backgroundColor: color,
        borderColor: color,
        borderWidth: 0,
        opacity: 1,
      };
    }

    if (isBarStartBeat) {
      return {
        backgroundColor: studioColors.beatActive,
        borderColor: studioColors.beatActive,
        borderWidth: 0,
        opacity: 0.55,
      };
    }

    return {
      backgroundColor: studioColors.beatInactivePlaying,
      borderColor: studioColors.beatInactivePlaying,
      borderWidth: 0,
      opacity: studioColors.beatLedRestingOpacity,
    };
  }

  if (isBarStartBeat) {
    return {
      backgroundColor: studioColors.tempoMarking,
      borderColor: studioColors.tempoMarking,
      borderWidth: 0,
      opacity: 1,
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

  // Click (unaccented): filled light blue, no border outline.
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
  isBarStartEnabled: boolean;
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
  isBarStartEnabled,
  onPress,
}: ClockBeatDotProps) {
  const isBeatOne = beatNumber === 1;
  const isBarStartBeat = isBeatOne && isBarStartEnabled;
  // Match audio: beat 1 is Bar or Click only — never Accent from accentPattern[0].
  const visualPatternAccent = isBeatOne ? false : isPatternAccent;
  const appearance = ledAppearance(isPlaying, isCurrentBeat, visualPatternAccent, isBarStartBeat);
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

  const accessibilityLabel = isBeatOne
    ? `Beat 1, Bar Start ${isBarStartEnabled ? 'on' : 'off'}`
    : `Beat ${beatNumber}, ${isPatternAccent ? 'accented' : 'normal'}`;
  const accessibilityHint = isBeatOne
    ? 'Double tap to toggle Bar Start'
    : 'Double tap to toggle accent';

  // Accents stay non-interactive during playback; beat 1 stays tappable for Bar Start.
  if (isPlaying && !isBeatOne) {
    return (
      <View style={positionStyle} pointerEvents="none">
        <View style={[styles.dot, dotStyle]} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => {
        // TEMP debug — remove after bar-start hit-test diagnosis
        if (isBeatOne) {
          console.log('[BarStartDebug] beat1 Pressable onPress fired');
        }
        onPress?.();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: isBeatOne ? isBarStartEnabled : isPatternAccent }}
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
 * Tap beat 1 to toggle Bar Start (idle or playing); tap other beats to toggle accents when idle.
 */
function ClockBeatIndicatorsComponent({
  diameter,
  strokeWidth,
  onAccentPatternChange,
}: ClockBeatIndicatorsProps) {
  const isPlaying = useAppSelector(selectIsPlaying);
  const accentPattern = useAppSelector(selectAccentPattern);
  const barStartEnabled = useAppSelector(selectBarStartEnabled);
  const timeSignature = useAppSelector(selectTimeSignature);
  const beatCount = timeSignature.numerator;
  const flashBeatIndex = useBeatFlashPulse(isPlaying, beatCount);

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

  const toggleAccentBeat = (beatIndex: number) => {
    const next = accentPattern.map((accent, index) =>
      index === beatIndex ? !accent : accent,
    );
    onAccentPatternChange([...next]);
  };

  const toggleBarStart = () => {
    // TEMP debug — remove after bar-start hit-test diagnosis
    const previous = barStartEnabled;
    const next = !barStartEnabled;
    console.log('[BarStartDebug] toggleBarStart entered', { previous, next });
    void clickSoundService.setBarStartEnabled(next);
  };

  if (beatCount <= 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.orbit, { width: diameter, height: diameter }]}
      accessibilityLabel={
        isPlaying
          ? 'Beat indicators, tap beat 1 for Bar Start'
          : 'Beat indicators, tap beat 1 for Bar Start, other beats for accents'
      }
    >
      {positions.map(({ beatIndex, size, left, top }) => (
        <ClockBeatDot
          key={beatIndex}
          beatNumber={beatIndex + 1}
          size={size}
          left={left}
          top={top}
          isPlaying={isPlaying}
          isCurrentBeat={isPlaying && beatIndex === flashBeatIndex}
          isPatternAccent={accentPattern[beatIndex] ?? false}
          isBarStartEnabled={barStartEnabled}
          onPress={beatIndex === 0 ? toggleBarStart : () => toggleAccentBeat(beatIndex)}
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
