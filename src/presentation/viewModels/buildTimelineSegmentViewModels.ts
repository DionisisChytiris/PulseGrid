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

/**
 * Geometry / content view models for the Signature Track FlatList.
 *
 * Playback highlight (`isActive` / bar active|past) is intentionally omitted from
 * the live timeline path — MeterRegion reads bar index from SongLineBar store so
 * FlatList `data` identity stays stable while playing.
 *
 * Pass `playback` only for status/readout builders that still need baked flags.
 */
export function buildTimelineSegmentViewModels(
  song: Song,
  playback?: TimelinePlaybackContext,
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
  playback: TimelinePlaybackContext | undefined,
): TimelineSegmentViewModel {
  const isActive =
    playback !== undefined &&
    playback.isTimelineActive &&
    playback.currentBarIndex >= segment.startBarIndex &&
    playback.currentBarIndex <= segment.endBarIndex;

  const activeBarIndex = isActive
    ? playback!.currentBarIndex - segment.startBarIndex
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
