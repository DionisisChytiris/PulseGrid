import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  initializeDebugTimingBridge,
  resetDebugTimingBridge,
  useDebugTiming,
} from '../../../infrastructure/audio/debugTimingBridge';

/** TEMP: dev-only scheduling/playback diagnostics — remove when investigation is done. */
export function DebugTimingOverlay() {
  const timing = useDebugTiming();

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    initializeDebugTimingBridge();
    return () => {
      resetDebugTimingBridge();
    };
  }, []);

  if (!__DEV__) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.container}>
      <Text style={styles.title}>Debug Timing</Text>
      <Text style={styles.row}>BPM: {timing.bpm.toFixed(1)}</Text>
      <Text style={styles.row}>Subdivision: {timing.subdivision}</Text>
      <Text style={styles.row}>Tick count: {timing.tickCount}</Text>
      <Text style={styles.row}>Avg lateness: {formatUs(timing.avgLatenessUs)}</Text>
      <Text style={styles.row}>Max lateness: {formatUs(timing.maxLatenessUs)}</Text>
      <Text style={styles.row}>Playback failures: {timing.playbackFailures}</Text>
    </View>
  );
}

function formatUs(value: number): string {
  return `${value.toFixed(1)} µs`;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 9999,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 180,
  },
  title: {
    color: '#7CFC00',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
