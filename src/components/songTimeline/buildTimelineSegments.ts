import type { Bar } from '../../domain/music/Bar';
import { getBarTempoBpm } from '../../domain/music/Bar';
import { formatMeter, metersEqual, type Meter } from '../../domain/music/Meter';
import type { Song } from '../../domain/music/Song';

import type { TimelineSegment } from './types';

function segmentBpmOverride(bars: readonly Bar[]): number | null {
  if (bars.length === 0) {
    return null;
  }

  const first = getBarTempoBpm(bars[0]);
  if (first === undefined) {
    return null;
  }

  const allSame = bars.every((bar) => getBarTempoBpm(bar) === first);
  return allSame ? first : null;
}

/**
 * Groups consecutive bars with the same meter into horizontal timeline segments.
 * Pure UI derivation — does not affect playback or scheduling.
 */
export function buildTimelineSegments(song: Song): TimelineSegment[] {
  const bars = song.sections[0]?.bars ?? [];
  if (bars.length === 0) {
    return [];
  }

  const segments: TimelineSegment[] = [];
  let runStart = 0;

  const pushSegment = (start: number, end: number) => {
    const slice = bars.slice(start, end + 1);
    const meter = slice[0].meter;

    segments.push({
      id: `seg-${start}`,
      startBarIndex: start,
      endBarIndex: end,
      numberOfBars: slice.length,
      meter,
      meterLabel: formatMeter(meter),
      barIds: slice.map((bar) => bar.id),
      bpmOverride: segmentBpmOverride(slice),
      accentPattern: slice[0].accentPattern,
    });
  };

  for (let index = 1; index <= bars.length; index += 1) {
    const prevMeter = bars[index - 1].meter;
    const atEnd = index === bars.length;
    const meterChanged =
      !atEnd && !metersEqual(prevMeter, bars[index].meter);

    if (atEnd || meterChanged) {
      pushSegment(runStart, index - 1);
      runStart = index;
    }
  }

  return segments;
}

export function findSegmentForBarIndex(
  segments: readonly TimelineSegment[],
  barIndex: number,
): TimelineSegment | null {
  return (
    segments.find(
      (segment) => barIndex >= segment.startBarIndex && barIndex <= segment.endBarIndex,
    ) ?? null
  );
}

export function findSegmentIndexForBar(
  segments: readonly TimelineSegment[],
  barIndex: number,
): number {
  return segments.findIndex(
    (segment) => barIndex >= segment.startBarIndex && barIndex <= segment.endBarIndex,
  );
}
