import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';

import {
  REGION_GAP,
  barCellWidth,
  meterRegionWidth,
  parseMeterDenominator,
} from './signatureTimelineConstants';

export function segmentStride(segment: TimelineSegmentViewModel): number {
  const denominator = parseMeterDenominator(segment.meter);
  return (
    meterRegionWidth(segment.numberOfBars, segment.accentPreview.length, denominator) +
    REGION_GAP
  );
}

/** Horizontal offset of a bar's leading edge within timeline regions (excludes viewport padding). */
export function barStartScrollOffset(
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
): number {
  let offset = 0;

  for (const segment of segments) {
    const segmentStartIndex = segment.startBar - 1;
    const segmentEndIndex = segment.endBar - 1;
    const beatsInBar = Math.max(1, segment.accentPreview.length);
    const denominator = parseMeterDenominator(segment.meter);
    const cellWidth = barCellWidth(beatsInBar, denominator);

    if (barIndex >= segmentStartIndex && barIndex <= segmentEndIndex) {
      return offset + (barIndex - segmentStartIndex) * cellWidth;
    }

    offset += segmentStride(segment);
  }

  return offset;
}

export function timelineSegmentsScrollWidth(
  segments: readonly TimelineSegmentViewModel[],
): number {
  return segments.reduce((total, segment) => total + segmentStride(segment), 0);
}

/**
 * Scroll offset that places the target bar's leading edge at the viewport center.
 * Symmetric horizontal padding (viewportWidth / 2) makes scrollX equal barStartScrollOffset.
 */
export function clampCenteredBarScrollOffset(
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  viewportWidth: number,
  trailingContentWidth = 0,
): number | null {
  if (viewportWidth <= 0) {
    return null;
  }

  const segmentsWidth = timelineSegmentsScrollWidth(segments);
  if (segmentsWidth + trailingContentWidth <= 0) {
    return null;
  }

  const contentWidth = viewportWidth + segmentsWidth + trailingContentWidth;
  if (contentWidth <= viewportWidth) {
    return null;
  }

  const barX = barStartScrollOffset(segments, barIndex);
  const maxScroll = contentWidth - viewportWidth;
  return Math.max(0, Math.min(barX, maxScroll));
}
