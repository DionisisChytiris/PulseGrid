import { buildTimelineSegments } from '../../components/songTimeline/buildTimelineSegments';
import type { TimelineSegment } from '../../components/songTimeline/types';
import type { Song } from '../../domain/music/Song';

import { buildAccentPreview } from './buildAccentPreview';
import { circledBarLabel } from './circledBarLabel';
import type { TimelineSegmentViewModel } from './TimelineSegmentViewModel';

export type TimelinePlaybackContext = {
  readonly currentBarIndex: number;
  readonly isTimelineActive: boolean;
};

export function buildTimelineSegmentViewModels(
  song: Song,
  playback: TimelinePlaybackContext,
): TimelineSegmentViewModel[] {
  const sectionName = song.sections[0]?.name ?? 'Main';
  const domainSegments = buildTimelineSegments(song);

  return domainSegments.map((segment) =>
    toViewModel(segment, sectionName, playback),
  );
}

export function findDomainSegmentById(song: Song, segmentId: string): TimelineSegment | null {
  return buildTimelineSegments(song).find((segment) => segment.id === segmentId) ?? null;
}

function toViewModel(
  segment: TimelineSegment,
  sectionName: string,
  playback: TimelinePlaybackContext,
): TimelineSegmentViewModel {
  const isActive =
    playback.isTimelineActive &&
    playback.currentBarIndex >= segment.startBarIndex &&
    playback.currentBarIndex <= segment.endBarIndex;

  const activeBarIndex = isActive
    ? playback.currentBarIndex - segment.startBarIndex
    : null;

  const barIndicators = Array.from({ length: segment.numberOfBars }, (_, offset) => {
    const barNumber = segment.startBarIndex + offset + 1;

    return {
      barNumber,
      label: circledBarLabel(barNumber),
      isActive: activeBarIndex === offset,
      isPast: activeBarIndex !== null && offset < activeBarIndex,
    };
  });

  return {
    id: segment.id,
    title: `${segment.numberOfBars} bars | ${segment.meterLabel}`,
    sectionName,
    meter: segment.meterLabel,
    numberOfBars: segment.numberOfBars,
    startBar: segment.startBarIndex + 1,
    endBar: segment.endBarIndex + 1,
    barIndicators,
    accentPreview: buildAccentPreview(segment.accentPattern, segment.meter.numerator),
    bpmOverride: segment.bpmOverride,
    isActive,
    activeBarIndex,
  };
}
