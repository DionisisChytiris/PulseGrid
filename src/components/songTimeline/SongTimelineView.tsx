import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';

import { SegmentEditBottomSheet } from './SegmentEditBottomSheet';
import { TimelineSegmentRow } from './TimelineSegmentRow';
import { studioColors } from '../../presentation/theme';
import { findDomainSegmentById } from '../../presentation/viewModels/buildTimelineSegmentViewModels';
import type { TimelineSegment } from './types';
import {
  AUTO_FOLLOW_SUSPEND_MS,
  TIMELINE_SEGMENT_GAP,
  TIMELINE_SEGMENT_WIDTH,
} from './timelineConstants';
import { buildTimelineSegments } from './buildTimelineSegments';
import { useTimelineAutoScroll } from './useTimelineAutoScroll';
import type { Song } from '../../domain/music/Song';

type Props = {
  song: Song;
  segments: readonly TimelineSegmentViewModel[];
  isTimelineActive: boolean;
  currentBarIndex: number;
  onSegmentBarCountChange: (segment: TimelineSegment, count: number) => void;
  onSegmentMeterChange: (segment: TimelineSegment, meterLabel: string) => void;
  onSegmentBpmOverrideChange: (segment: TimelineSegment, bpm: number | null) => void;
  onSegmentAccentPatternChange: (segment: TimelineSegment, pattern: boolean[]) => void;
};

export function SongTimelineView({
  song,
  segments,
  isTimelineActive,
  currentBarIndex,
  onSegmentBarCountChange,
  onSegmentMeterChange,
  onSegmentBpmOverrideChange,
  onSegmentAccentPatternChange,
}: Props) {
  const listRef = useRef<FlatList<TimelineSegmentViewModel>>(null);
  const segmentLayouts = useRef(new Map<string, { x: number; width: number }>());
  const autoFollowSuspendedUntil = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [segmentEditorVisible, setSegmentEditorVisible] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);

  const domainSegments = useMemo(() => buildTimelineSegments(song), [song]);

  useTimelineAutoScroll({
    listRef,
    segments: domainSegments,
    currentBarIndex,
    isTimelineActive,
    segmentLayouts,
    viewportWidth,
    autoFollowSuspendedUntil,
  });

  const onManualScroll = useCallback(() => {
    autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
  }, []);

  const handleScrollBeginDrag = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onManualScroll();
    },
    [onManualScroll],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<TimelineSegmentViewModel> | null | undefined, index: number) => ({
      length: TIMELINE_SEGMENT_WIDTH + TIMELINE_SEGMENT_GAP,
      offset: (TIMELINE_SEGMENT_WIDTH + TIMELINE_SEGMENT_GAP) * index,
      index,
    }),
    [],
  );

  if (segments.length === 0) {
    return <Text style={styles.empty}>No bars yet. Add a bar to build the timeline.</Text>;
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>Timeline</Text>

      <View
        style={styles.listContainer}
        onLayout={(event) => {
          setViewportWidth(event.nativeEvent.layout.width);
        }}
      >
        <FlatList
          ref={listRef}
          horizontal
          data={segments as TimelineSegmentViewModel[]}
          keyExtractor={(item) => `${item.id}-${item.numberOfBars}-${item.meter}`}
          renderItem={({ item }) => (
            <TimelineSegmentRow
              segment={item}
              onPress={(segmentId) => {
                setFocusSegmentId(segmentId);
                setSegmentEditorVisible(true);
              }}
              onLayout={(segmentId, x, width) => {
                segmentLayouts.current.set(segmentId, { x, width });
              }}
            />
          )}
          getItemLayout={getItemLayout}
          showsHorizontalScrollIndicator
          decelerationRate="fast"
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollBegin={handleScrollBeginDrag}
          contentContainerStyle={styles.listContent}
          extraData={`${currentBarIndex}-${isTimelineActive}`}
          windowSize={5}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          removeClippedSubviews
        />
      </View>

      <SegmentEditBottomSheet
        visible={segmentEditorVisible}
        segments={segments}
        focusSegmentId={focusSegmentId}
        onClose={() => {
          setSegmentEditorVisible(false);
          setFocusSegmentId(null);
        }}
        onBarCountChange={(segmentId, count) => {
          const domain = findDomainSegmentById(song, segmentId);
          if (domain !== null) {
            onSegmentBarCountChange(domain, count);
          }
        }}
        onMeterChange={(segmentId, meter) => {
          const domain = findDomainSegmentById(song, segmentId);
          if (domain !== null) {
            onSegmentMeterChange(domain, meter);
          }
        }}
        onBpmOverrideChange={(segmentId, bpm) => {
          const domain = findDomainSegmentById(song, segmentId);
          if (domain !== null) {
            onSegmentBpmOverrideChange(domain, bpm);
          }
        }}
        onAccentPatternChange={(segmentId, pattern) => {
          const domain = findDomainSegmentById(song, segmentId);
          if (domain !== null) {
            onSegmentAccentPatternChange(domain, pattern);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: studioColors.textPrimary, marginBottom: 8 },
  listContainer: { minHeight: 200 },
  listContent: { paddingHorizontal: 4, paddingVertical: 8 },
  empty: { color: studioColors.textSecondary, textAlign: 'center', marginVertical: 16 },
});
