import type { Bar } from '../../domain/music/Bar';
import { getBarTempoBpm } from '../../domain/music/Bar';
import { formatMeter, type Meter } from '../../domain/music/Meter';
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

function sameSignature(a: Meter, b: Meter): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

/**
 * Groups consecutive bars into Signature Track / Edit Segment regions.
 * A new region starts when the meter changes, after a bar marked
 * `segmentBreakAfter`, or at a Song.sections boundary.
 * Pure UI derivation — does not affect playback or scheduling.
 */
export function buildTimelineSegments(song: Song): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  let globalIndex = 0;

  for (const section of song.sections) {
    const bars = section.bars;
    if (bars.length === 0) {
      continue;
    }

    let runStart = 0;

    const pushSegment = (start: number, end: number) => {
      const slice = bars.slice(start, end + 1);
      const meter = slice[0].meter;
      const startBarIndex = globalIndex + start;

      segments.push({
        id: `seg-${startBarIndex}`,
        startBarIndex,
        endBarIndex: globalIndex + end,
        numberOfBars: slice.length,
        meter,
        meterLabel: formatMeter(meter),
        barIds: slice.map((bar) => bar.id),
        bpmOverride: segmentBpmOverride(slice),
        accentPattern: slice[0].accentPattern,
        sectionId: section.id,
        sectionName: section.name,
      });
    };

    for (let index = 1; index <= bars.length; index += 1) {
      const prevBar = bars[index - 1];
      const atEnd = index === bars.length;
      const signatureChanged =
        !atEnd && !sameSignature(prevBar.meter, bars[index].meter);
      const forcedBreak = prevBar.segmentBreakAfter === true;

      if (atEnd || signatureChanged || forcedBreak) {
        pushSegment(runStart, index - 1);
        runStart = index;
      }
    }

    globalIndex += bars.length;
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
