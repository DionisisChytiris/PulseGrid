import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { usePracticeTimer } from '../../hooks/usePracticeTimer';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';

type PracticeTimerProps = {
  isPlaying: boolean;
};

export function PracticeTimer({ isPlaying }: PracticeTimerProps) {
  const layout = useResponsiveLayout();
  const { isArmed, elapsedMs, displayTime, toggle, reset } = usePracticeTimer(isPlaying);

  const metrics = useMemo(
    () => ({
      resetSize: layout.scale(36, 0.08, 0.05),
      inactiveFontSize: layout.scale(16),
      valueFontSize: layout.scale(20, 0.08, 0.05),
      iconSize: layout.scale(22, 0.05, 0.05),
      minWidth: layout.scale(72, 0.05, 0.05),
    }),
    [layout],
  );

  const showReset = isArmed && !isPlaying && elapsedMs > 0;

  return (
    <View style={styles.timerRow}>
      {showReset ? (
        <Pressable
          style={[
            styles.resetButton,
            { width: metrics.resetSize, height: metrics.resetSize, borderRadius: metrics.resetSize / 2 },
          ]}
          onPress={reset}
          accessibilityRole="button"
          accessibilityLabel="Reset timer to zero"
        >
          <Ionicons name="refresh" size={metrics.iconSize} color="#007AFF" />
        </Pressable>
      ) : null}

      <Pressable
        style={[
          styles.timer,
          { minWidth: metrics.minWidth },
          isArmed && styles.timerArmed,
          isPlaying && styles.timerRunning,
        ]}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={
          isArmed
            ? `Practice timer ${displayTime}. Tap to deactivate.`
            : 'Practice timer. Tap to activate.'
        }
        accessibilityState={{ selected: isArmed }}
      >
        {isArmed ? (
          <Text style={[styles.timerValue, { fontSize: metrics.valueFontSize }]}>{displayTime}</Text>
        ) : (
          <Text style={[styles.timerInactive, { fontSize: metrics.inactiveFontSize }]}>Timer</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resetButton: {
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    alignItems: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timerArmed: {
    backgroundColor: '#F2F2F7',
  },
  timerRunning: {
    backgroundColor: '#E8F4FF',
  },
  timerInactive: {
    fontWeight: '600',
    color: '#AEAEB2',
  },
  timerValue: {
    fontWeight: '600',
    color: '#000000',
    fontVariant: ['tabular-nums'],
  },
});
