import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { BarPreview } from './BarPreview';
import {
  TRACK_HEIGHT,
  meterRegionWidth,
  parseMeterDenominator,
} from './signatureTimelineConstants';

type Props = {
  segment: TimelineSegmentViewModel;
  onPress?: (segmentId: string) => void;
  onLayout?: (segmentId: string, x: number, width: number) => void;
  /** Song playback running — pulse LEDs follow the playhead beat. */
  isPlaying?: boolean;
  /** 0-based beat index within the active bar. */
  currentBeatIndex?: number;
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
  isPlaying = false,
  currentBeatIndex = -1,
}: Props) {
  const beatCount = Math.max(1, segment.accentPreview.length);
  const denominator = parseMeterDenominator(segment.meter);
  const width = meterRegionWidth(segment.numberOfBars, beatCount, denominator);
  const regionPlaying = isPlaying && segment.isActive;

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
        {segment.bpmOverride !== null ? (
          <Text style={styles.bpm}>♩ = {segment.bpmOverride}</Text>
        ) : null}
      </View>

      <View style={[styles.track, segment.isActive && styles.trackActive]}>
        {segment.barIndicators.map((indicator) => (
          <BarPreview
            key={`bar-${indicator.barNumber}`}
            beats={segment.accentPreview}
            denominator={denominator}
            isActive={indicator.isActive}
            isPast={indicator.isPast}
            isPlaying={regionPlaying}
            currentBeatIndex={currentBeatIndex}
          />
        ))}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  region: {
    height: '100%',
    paddingTop: 2,
    paddingBottom: 8,
  },
  regionActive: {
    // Region chrome emphasizes active meter without shrinking content.
  },
  header: {
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  meter: {
    fontSize: 18,
    fontWeight: '800',
    color: studioColors.textPrimary,
    letterSpacing: 0.3,
  },
  bpm: {
    fontSize: 11,
    fontWeight: '700',
    color: studioColors.beatAccent,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: TRACK_HEIGHT,
    backgroundColor: studioColors.surface,
    // Visible so section-start pulse markers are not clipped to half-circles.
    overflow: 'visible',
  },
  trackActive: {
    backgroundColor: studioColors.surfaceElevated,
    shadowColor: studioColors.accent,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
