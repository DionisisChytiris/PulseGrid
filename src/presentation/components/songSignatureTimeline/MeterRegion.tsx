import { Fragment, memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { BarPreview } from './BarPreview';
import {
  BAR_DIVIDER_WIDTH,
  REGION_PADDING,
  TRACK_HEIGHT,
  meterRegionWidth,
} from './signatureTimelineConstants';

type Props = {
  segment: TimelineSegmentViewModel;
  onPress?: (segmentId: string) => void;
  onLayout?: (segmentId: string, x: number, width: number) => void;
};

/**
 * Cubase-style Signature Track region:
 *
 *        4/4 · 2 bars
 * ┌──────────────────┐
 * │● ○ ○ ○│● ○ ○ ○│
 * └──────────────────┘
 */
export const MeterRegion = memo(function MeterRegion({
  segment,
  onPress,
  onLayout,
}: Props) {
  const beatCount = Math.max(1, segment.accentPreview.length);
  const width = meterRegionWidth(segment.numberOfBars, beatCount);
  const barsLabel =
    segment.numberOfBars === 1 ? '1 bar' : `${segment.numberOfBars} bars`;

  return (
    <Pressable
      onPress={() => onPress?.(segment.id)}
      disabled={onPress === undefined}
      style={[styles.region, { width }, segment.isActive && styles.regionActive]}
      onLayout={(event) => {
        const { x, width: layoutWidth } = event.nativeEvent.layout;
        onLayout?.(segment.id, x, layoutWidth);
      }}
    >
      <View style={styles.header}>
        <Text style={styles.meter}>{segment.meter}</Text>
        <Text style={styles.barsMeta}>{barsLabel}</Text>
      </View>

      {segment.bpmOverride !== null ? (
        <Text style={styles.bpm}>♩ = {segment.bpmOverride}</Text>
      ) : null}

      <View style={[styles.track, segment.isActive && styles.trackActive]}>
        {segment.barIndicators.map((indicator, offset) => (
          <Fragment key={`bar-${indicator.barNumber}`}>
            {offset > 0 ? <View style={styles.divider} /> : null}
            <BarPreview
              beats={segment.accentPreview}
              isActive={indicator.isActive}
              isPast={indicator.isPast}
            />
          </Fragment>
        ))}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  region: {
    paddingHorizontal: REGION_PADDING,
    paddingTop: 4,
    paddingBottom: REGION_PADDING,
  },
  regionActive: {
    // Region chrome emphasizes active meter without shrinking content.
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
    gap: 2,
  },
  meter: {
    fontSize: 22,
    fontWeight: '800',
    color: studioColors.textPrimary,
    letterSpacing: 0.5,
  },
  barsMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: studioColors.textMuted,
  },
  bpm: {
    textAlign: 'center',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '700',
    color: studioColors.beatAccent,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: TRACK_HEIGHT,
    borderWidth: 1.5,
    borderColor: studioColors.border,
    borderRadius: 12,
    backgroundColor: studioColors.surface,
    overflow: 'hidden',
  },
  trackActive: {
    borderColor: studioColors.accent,
    borderWidth: 2,
    backgroundColor: studioColors.surfaceElevated,
    shadowColor: studioColors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  divider: {
    width: BAR_DIVIDER_WIDTH,
    backgroundColor: studioColors.border,
  },
});
