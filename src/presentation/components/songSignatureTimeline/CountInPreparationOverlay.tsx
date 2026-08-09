import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { CountInProgressState } from '../../../features/songPlayback/songPlaybackSlice';
import { studioColors } from '../../theme';

type Props = {
  countIn: CountInProgressState;
};

/**
 * Lightweight, non-interactive count-in HUD.
 * Positioned in the left half of the timeline content area — text only.
 */
export function CountInPreparationOverlay({ countIn }: Props) {
  const { height } = useWindowDimensions();
  const barNumber = countIn.barIndex + 1;
  const beatNumber = countIn.beatIndexInBar + 1;
  const beatOpacity = useRef(new Animated.Value(1)).current;
  const beatKey = `${countIn.barIndex}-${countIn.beatIndexInBar}`;

  useEffect(() => {
    beatOpacity.setValue(0.35);
    Animated.timing(beatOpacity, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [beatKey, beatOpacity]);

  const beatFontSize = height < 400 ? 56 : height < 500 ? 64 : 72;

  return (
    <View
      pointerEvents="none"
      style={styles.root}
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.leftHalf}>
        <View style={styles.centerCluster}>
          <Text style={styles.getReady}>Get Ready</Text>
          <Text style={styles.barLabel}>
            Bar {barNumber} of {countIn.totalBars}
          </Text>
          <Animated.Text
            style={[
              styles.beat,
              {
                fontSize: beatFontSize,
                opacity: beatOpacity,
              },
            ]}
          >
            {beatNumber}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  leftHalf: {
    width: '50%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCluster: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  getReady: {
    fontSize: 21,
    fontWeight: '500',
    color: studioColors.textSecondary,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: studioColors.textMuted,
  },
  beat: {
    marginTop: 4,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
  },
});
