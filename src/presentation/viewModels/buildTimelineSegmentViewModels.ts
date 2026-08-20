import { buildTimelineSegments } from '../../components/songTimeline/buildTimelineSegments';
import type { TimelineSegment } from '../../components/songTimeline/types';
import type { Song } from '../../domain/music/Song';
import { songHasExplicitSectionVisuals } from '../components/songSignatureTimeline/sectionTrackVisual';

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
  const domainSegments = buildTimelineSegments(song);
  const showSectionVisuals = songHasExplicitSectionVisuals(song.sections);
  const colorIndexBySectionId = new Map<string, number>();

  for (const segment of domainSegments) {
    if (!colorIndexBySectionId.has(segment.sectionId)) {
      colorIndexBySectionId.set(segment.sectionId, colorIndexBySectionId.size);
    }
  }

  return domainSegments.map((segment, index) =>
    toViewModel(segment, playback, {
      isSectionStart:
        index === 0 || domainSegments[index - 1]!.sectionId !== segment.sectionId,
      sectionColorIndex: colorIndexBySectionId.get(segment.sectionId) ?? 0,
      showSectionVisuals,
    }),
  );
}

export function findDomainSegmentById(song: Song, segmentId: string): TimelineSegment | null {
  return buildTimelineSegments(song).find((segment) => segment.id === segmentId) ?? null;
}

function toViewModel(
  segment: TimelineSegment,
  playback: TimelinePlaybackContext | undefined,
  sectionVisual: {
    isSectionStart: boolean;
    sectionColorIndex: number;
    showSectionVisuals: boolean;
  },
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
    sectionId: segment.sectionId,
    sectionName: segment.sectionName,
    isSectionStart: sectionVisual.isSectionStart,
    sectionColorIndex: sectionVisual.sectionColorIndex,
    showSectionVisuals: sectionVisual.showSectionVisuals,
    meter: segment.meterLabel,
    numberOfBars: segment.numberOfBars,
    startBar: segment.startBarIndex + 1,
    endBar: segment.endBarIndex + 1,
    barIndicators,
    accentPreview: buildAccentPreview(segment.accentPattern, segment.meter.numerator),
    bpmOverride: segment.bpmOverride,
    subdivision: segment.subdivision,
    isActive,
    activeBarIndex,
  };
}
