import { StyleSheet, Text, View } from 'react-native';

import type { PlaybackStatusViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

type Props = {
  status: PlaybackStatusViewModel;
};

export function TimelinePlaybackPanel({ status }: Props) {
  if (!status.isActive) {
    return (
      <View style={styles.panel}>
        <Text style={styles.idle}>Press Play to follow the timeline</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.row}>
        <Text style={styles.label}>Current Section: </Text>
        <Text style={styles.value}>{status.sectionName}</Text>
      </Text>
      <Text style={styles.row}>
        <Text style={styles.label}>Current Bar: </Text>
        <Text style={styles.value}>
          {status.currentBar} / {status.totalBars}
        </Text>
      </Text>
      <Text style={styles.row}>
        <Text style={styles.label}>Current Beat: </Text>
        <Text style={styles.value}>
          {status.currentBeat} / {status.beatsInBar}
        </Text>
      </Text>
      <Text style={styles.row}>
        <Text style={styles.label}>Tempo: </Text>
        <Text style={styles.value}>{status.tempo ?? '—'} BPM</Text>
      </Text>
      <Text style={styles.row}>
        <Text style={styles.label}>Meter: </Text>
        <Text style={styles.value}>{status.meter}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  idle: { color: studioColors.textSecondary, fontSize: 13, textAlign: 'center' },
  row: { marginBottom: 4 },
  label: { color: studioColors.textSecondary, fontSize: 13 },
  value: { color: studioColors.textPrimary, fontSize: 13, fontWeight: '700' },
});
