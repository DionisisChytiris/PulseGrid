import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { SegmentEditBottomSheet } from '../../../components/songTimeline/SegmentEditBottomSheet';
import { AUTO_FOLLOW_SUSPEND_MS } from '../../../components/songTimeline/timelineConstants';
import { useTimelineAutoScroll } from '../../../components/songTimeline/useTimelineAutoScroll';
import { buildTimelineSegments } from '../../../components/songTimeline/buildTimelineSegments';
import type { TimelineSegment } from '../../../components/songTimeline/types';
import type { Song } from '../../../domain/music/Song';
import { findDomainSegmentById } from '../../viewModels/buildTimelineSegmentViewModels';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { MeterRegion } from './MeterRegion';
import { REGION_GAP, meterRegionWidth } from './signatureTimelineConstants';

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

function segmentStride(segment: TimelineSegmentViewModel): number {
  return meterRegionWidth(segment.numberOfBars, segment.accentPreview.length) + REGION_GAP;
}

/**
 * Cubase-style Signature Track: horizontal meter regions from Song segments.
 */
export function SongSignatureTimeline({
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
      : (segments.find((segment) => segment.id === editingSegmentId) ?? null);

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
    (_data: ArrayLike<TimelineSegmentViewModel> | null | undefined, index: number) => {
      const segment = segments[index];
      const length = segment ? segmentStride(segment) : REGION_GAP;
      let offset = 0;
      for (let i = 0; i < index; i += 1) {
        offset += segmentStride(segments[i]);
      }
      return { length, offset, index };
    },
    [segments],
  );

  if (segments.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.empty}>No meter regions yet. Add a bar to start the timeline.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.trackRule} />
      <View
        style={styles.listContainer}
        onLayout={(event) => {
          setViewportWidth(event.nativeEvent.layout.width);
        }}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          horizontal
          data={segments as TimelineSegmentViewModel[]}
          keyExtractor={(item) => `${item.id}-${item.meter}-${item.numberOfBars}`}
          renderItem={({ item, index }) => (
            <View style={styles.item}>
              <MeterRegion
                segment={item}
                onPress={setEditingSegmentId}
                onLayout={(segmentId, _x, width) => {
                  // FlatList onLayout x is parent-relative; store content offset instead.
                  let contentX = 0;
                  for (let i = 0; i < index; i += 1) {
                    contentX += segmentStride(segments[i]);
                  }
                  segmentLayouts.current.set(segmentId, { x: contentX, width });
                }}
              />
            </View>
          )}
          getItemLayout={getItemLayout}
          showsHorizontalScrollIndicator
          decelerationRate="fast"
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollBegin={handleScrollBeginDrag}
          contentContainerStyle={styles.content}
          extraData={`${currentBarIndex}-${isTimelineActive}`}
          windowSize={5}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
        />
      </View>
      <View style={styles.trackRule} />

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
  wrapper: {
    flex: 1,
    minHeight: 200,
  },
  trackRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: studioColors.border,
    marginHorizontal: 4,
  },
  listContainer: {
    flex: 1,
    minHeight: 160,
  },
  list: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
  item: {
    marginRight: REGION_GAP,
    justifyContent: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  empty: {
    color: studioColors.textSecondary,
    textAlign: 'center',
    fontSize: 15,
  },
});
