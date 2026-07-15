import { StyleSheet, Text, View } from 'react-native';

import type { PlaybackStatusViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

type Props = {
  status: PlaybackStatusViewModel;
};

/** Compact single-line playback status — keeps Signature Track visible in landscape. */
export function TimelinePlaybackPanel({ status }: Props) {
  if (!status.isActive) {
    return (
      <View style={styles.strip}>
        <Text style={styles.idle} numberOfLines={1}>
          Press Play to follow the timeline
        </Text>
      </View>
    );
  }

  const tempoLabel = status.tempo !== null ? `${status.tempo} BPM` : '— BPM';
  const line = `Bar ${status.currentBar}/${status.totalBars} · Beat ${status.currentBeat}/${status.beatsInBar} · ${status.meter} · ${tempoLabel}`;

  return (
    <View style={styles.strip}>
      <Text style={styles.active} numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
    justifyContent: 'center',
  },
  idle: {
    color: studioColors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  active: {
    color: studioColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
