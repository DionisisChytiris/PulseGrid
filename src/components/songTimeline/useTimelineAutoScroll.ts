import { useEffect, useRef } from 'react';
import type { FlatList } from 'react-native';

import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';

import { findSegmentIndexForBar } from './buildTimelineSegments';
import type { TimelineSegment } from './types';
import {
  AUTO_FOLLOW_SUSPEND_MS,
  TIMELINE_SEGMENT_GAP,
  TIMELINE_SEGMENT_WIDTH,
} from './timelineConstants';

type SegmentLayout = { x: number; width: number };

type Options = {
  listRef: React.RefObject<FlatList<TimelineSegmentViewModel> | null>;
  segments: readonly TimelineSegment[];
  currentBarIndex: number;
  isTimelineActive: boolean;
  segmentLayouts: React.MutableRefObject<Map<string, SegmentLayout>>;
  viewportWidth: number;
  autoFollowSuspendedUntil: React.MutableRefObject<number>;
};

/**
 * Auto-scrolls to center the active segment during playback.
 * Scrolls only when the active segment changes.
 * Respects manual-scroll suspension (~3s).
 */
export function useTimelineAutoScroll({
  listRef,
  segments,
  currentBarIndex,
  isTimelineActive,
  segmentLayouts,
  viewportWidth,
  autoFollowSuspendedUntil,
}: Options): void {
  const lastScrolledSegmentId = useRef<string | null>(null);

  useEffect(() => {
    if (!isTimelineActive || segments.length === 0 || viewportWidth <= 0) {
      lastScrolledSegmentId.current = null;
      return;
    }

    if (Date.now() < autoFollowSuspendedUntil.current) {
      return;
    }

    const segmentIndex = findSegmentIndexForBar(segments, currentBarIndex);
    if (segmentIndex < 0) {
      return;
    }

    const segment = segments[segmentIndex];
    if (segment.id === lastScrolledSegmentId.current) {
      return;
    }

    lastScrolledSegmentId.current = segment.id;

    const layout = segmentLayouts.current.get(segment.id);
    const cardWidth = layout?.width ?? TIMELINE_SEGMENT_WIDTH;
    const cardX =
      layout?.x ?? segmentIndex * (TIMELINE_SEGMENT_WIDTH + TIMELINE_SEGMENT_GAP);
    const targetOffset = Math.max(0, cardX - (viewportWidth - cardWidth) / 2);

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
    });
  }, [
    autoFollowSuspendedUntil,
    currentBarIndex,
    isTimelineActive,
    listRef,
    segmentLayouts,
    segments,
    viewportWidth,
  ]);
}
