import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AccentPreviewBeat } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

type Props = {
  beats: readonly AccentPreviewBeat[];
};

/** Visual accent row: ▲ accented beat, ○ normal beat. */
export const AccentBeatPreview = memo(function AccentBeatPreview({ beats }: Props) {
  return (
    <View style={styles.row}>
      {beats.map((beat, index) => (
        <Text
          key={`accent-beat-${index}`}
          style={[styles.glyph, beat.symbol === 'accent' ? styles.accent : styles.normal]}
        >
          {beat.symbol === 'accent' ? '▲' : '○'}
        </Text>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  glyph: { fontSize: 13, lineHeight: 16 },
  accent: { color: studioColors.accent },
  normal: { color: studioColors.textMuted },
});
