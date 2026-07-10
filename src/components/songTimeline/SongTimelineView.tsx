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
  meterOptions: readonly string[];
  isTimelineActive: boolean;
  currentBarIndex: number;
  onSegmentBarCountChange: (segment: TimelineSegment, count: number) => void;
  onSegmentMeterChange: (segment: TimelineSegment, meterLabel: string) => void;
  onSegmentBpmOverrideChange: (segment: TimelineSegment, bpm: number | null) => void;
  onSegmentAccentChange: (segment: TimelineSegment, presetId: string) => void;
};

export function SongTimelineView({
  song,
  segments,
  meterOptions,
  isTimelineActive,
  currentBarIndex,
  onSegmentBarCountChange,
  onSegmentMeterChange,
  onSegmentBpmOverrideChange,
  onSegmentAccentChange,
}: Props) {
  const listRef = useRef<FlatList<TimelineSegmentViewModel>>(null);
  const segmentLayouts = useRef(new Map<string, { x: number; width: number }>());
  const autoFollowSuspendedUntil = useRef(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);

  const domainSegments = useMemo(() => buildTimelineSegments(song), [song]);
  const editingDomainSegment =
    editingSegmentId === null ? null : findDomainSegmentById(song, editingSegmentId);
  const editingViewModel =
    editingSegmentId === null
      ? null
      : segments.find((segment) => segment.id === editingSegmentId) ?? null;

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
              onPress={setEditingSegmentId}
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
        visible={editingDomainSegment !== null && editingViewModel !== null}
        segment={editingViewModel}
        meterOptions={meterOptions}
        onClose={() => setEditingSegmentId(null)}
        onBarCountChange={(count) => {
          if (editingDomainSegment !== null) {
            onSegmentBarCountChange(editingDomainSegment, count);
          }
        }}
        onMeterChange={(meter) => {
          if (editingDomainSegment !== null) {
            onSegmentMeterChange(editingDomainSegment, meter);
          }
        }}
        onBpmOverrideChange={(bpm) => {
          if (editingDomainSegment !== null) {
            onSegmentBpmOverrideChange(editingDomainSegment, bpm);
          }
        }}
        onAccentChange={(presetId) => {
          if (editingDomainSegment !== null) {
            onSegmentAccentChange(editingDomainSegment, presetId);
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
