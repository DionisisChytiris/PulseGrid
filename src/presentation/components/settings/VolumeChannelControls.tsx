import { StyleSheet, Text, View } from 'react-native';

import { CLICK_VOLUME_CHANNELS } from '../../../domain/metronome/ClickVolume';
import { useClickVolumes } from '../../hooks/useClickVolumes';
import { useResponsiveLayout } from '../../layout/useResponsiveLayout';
import { studioColors } from '../../theme';
import { VolumePercentSlider } from '../metronome/VolumePercentSlider';

export function VolumeChannelControls() {
  const layout = useResponsiveLayout();
  const { volumes, setChannelVolume } = useClickVolumes();

  return (
    <View style={styles.group}>
      {CLICK_VOLUME_CHANNELS.map((channel) => {
        const value = volumes[channel.key];
        return (
          <View key={channel.key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text
                style={[styles.label, { fontSize: layout.displayFontSize(13) }]}
                numberOfLines={1}
              >
                {channel.label}
              </Text>
              <Text style={[styles.value, { fontSize: layout.displayFontSize(13) }]}>
                {value}%
              </Text>
            </View>
            <VolumePercentSlider
              value={value}
              accessibilityLabel={channel.label}
              onValueChange={(next) => setChannelVolume(channel.key, next)}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
    gap: 15,
    overflow: 'visible',
  },
  row: {
    gap: 8,
    paddingVertical: 4,
    overflow: 'visible',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 2,
  },
  label: {
    flex: 1,
    color: studioColors.textPrimary,
    fontWeight: '600',
  },
  value: {
    color: studioColors.textMuted,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
