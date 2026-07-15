import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AccentPreviewBeat } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { BeatAccentIndicator } from './BeatAccentIndicator';
import {
  BAR_CELL_PADDING_H,
  BAR_CELL_PADDING_V,
  BEAT_GAP,
  BEAT_SIZE,
  TRACK_HEIGHT,
  barCellWidth,
} from './signatureTimelineConstants';

type Props = {
  beats: readonly AccentPreviewBeat[];
  isActive?: boolean;
  isPast?: boolean;
};

/**
 * One bar cell inside a Signature Track region:
 * │● ○ ○ ○│
 */
export const BarPreview = memo(function BarPreview({
  beats,
  isActive = false,
  isPast = false,
}: Props) {
  const width = barCellWidth(beats.length);

  return (
    <View
      style={[
        styles.cell,
        { width, minHeight: TRACK_HEIGHT },
        isPast && styles.past,
        isActive && styles.active,
      ]}
    >
      <View style={styles.beatRow}>
        {beats.map((beat, index) => (
          <BeatAccentIndicator
            key={`beat-${index}`}
            accented={beat.symbol === 'accent'}
            size={BEAT_SIZE}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: BAR_CELL_PADDING_H,
    paddingVertical: BAR_CELL_PADDING_V,
  },
  past: {
    backgroundColor: 'rgba(59, 158, 255, 0.1)',
  },
  active: {
    backgroundColor: studioColors.accentMutedBg,
  },
  beatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: BEAT_GAP,
  },
});
