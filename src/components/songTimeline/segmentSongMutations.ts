import {
  createAccentPatternGrouped,
  createAccentPatternSteps,
  cloneSongAccentPattern,
  downbeatAccentPattern,
  type SongAccentPattern,
} from '../../domain/music/AccentPattern';
import { cloneBarTempoFields, createBar, type Bar } from '../../domain/music/Bar';
import { cloneClickPattern } from '../../domain/music/ClickPattern';
import {
  addBarToSong,
  deleteBarFromSong,
  updateBarBpm,
  updateBarMeter,
} from '../../domain/music/editor';
import { cloneMeter, createMeter, metersEqual, type Meter } from '../../domain/music/Meter';
import type { Song } from '../../domain/music/Song';
import { generateEntityId } from '../../domain/music/storage/generateEntityId';

import { buildTimelineSegments } from './buildTimelineSegments';
import type { TimelineSegment } from './types';

function mainBars(song: Song) {
  return song.sections[0]?.bars ?? [];
}

function replaceMainBars(song: Song, bars: readonly Bar[]): Song {
  const section = song.sections[0];
  if (section === undefined) {
    return song;
  }

  return {
    ...song,
    updatedAt: Date.now(),
    sections: [{ ...section, bars }, ...song.sections.slice(1)],
  };
}

function setBarSegmentBreakAfter(bar: Bar, segmentBreakAfter: boolean): Bar {
  if (segmentBreakAfter) {
    return { ...bar, segmentBreakAfter: true };
  }

  const { segmentBreakAfter: _removed, ...rest } = bar;
  return rest;
}

/** Clone a bar with a new unique id — copies meter, accents, tempo, click pattern. */
export function cloneBarWithNewId(bar: Bar): Bar {
  return createBar({
    id: generateEntityId('bar'),
    meter: cloneMeter(bar.meter),
    accentPattern: cloneSongAccentPattern(bar.accentPattern),
    repeatCount: bar.repeatCount,
    ...cloneBarTempoFields(bar),
    ...(bar.clickPattern === undefined
      ? {}
      : { clickPattern: cloneClickPattern(bar.clickPattern) }),
  });
}

function insertBarAtIndex(song: Song, index: number, meter: Meter): Song {
  const section = song.sections[0];
  if (section === undefined) {
    return addBarToSong(song, meter);
  }

  const newBar = createBar({
    id: generateEntityId('bar'),
    meter,
    accentPattern: downbeatAccentPattern(meter.numerator),
  });

  const bars = [...section.bars];
  const clampedIndex = Math.max(0, Math.min(index, bars.length));
  bars.splice(clampedIndex, 0, newBar);

  return replaceMainBars(song, bars);
}

/**
 * Length of the UI segment starting at [startBarIndex], stopping at meter
 * change or `segmentBreakAfter` (inclusive of the break bar).
 */
function segmentRunLength(song: Song, startBarIndex: number, meter: Meter): number {
  const bars = mainBars(song);
  let count = 0;

  for (let index = startBarIndex; index < bars.length; index += 1) {
    const bar = bars[index];
    if (!metersEqual(bar.meter, meter)) {
      break;
    }

    count += 1;
    if (bar.segmentBreakAfter === true) {
      break;
    }
  }

  return count;
}

/** Segment-level bar count — UI/editor only; persists via SongRepository. */
export function setSegmentBarCount(song: Song, segment: TimelineSegment, targetCount: number): Song {
  const safeCount = Math.max(1, Math.floor(targetCount));
  let next = song;

  while (segmentRunLength(next, segment.startBarIndex, segment.meter) < safeCount) {
    const runLen = segmentRunLength(next, segment.startBarIndex, segment.meter);
    const lastIndex = segment.startBarIndex + runLen - 1;
    const bars = mainBars(next);
    const lastBar = bars[lastIndex];
    const insertAt = lastIndex + 1;
    const hadBreak = lastBar?.segmentBreakAfter === true;

    next = insertBarAtIndex(next, insertAt, segment.meter);

    if (hadBreak && lastBar !== undefined) {
      const updated = [...mainBars(next)];
      updated[lastIndex] = setBarSegmentBreakAfter(updated[lastIndex], false);
      updated[insertAt] = setBarSegmentBreakAfter(updated[insertAt], true);
      next = replaceMainBars(next, updated);
    }
  }

  while (segmentRunLength(next, segment.startBarIndex, segment.meter) > safeCount) {
    const bars = mainBars(next);
    const runLen = segmentRunLength(next, segment.startBarIndex, segment.meter);
    const removeIndex = segment.startBarIndex + runLen - 1;
    const removed = bars[removeIndex];
    const barId = removed?.id;

    if (barId === undefined) {
      break;
    }

    const hadBreak = removed.segmentBreakAfter === true;
    next = deleteBarFromSong(next, barId);

    if (hadBreak) {
      const remainingLen = segmentRunLength(next, segment.startBarIndex, segment.meter);
      if (remainingLen > 0) {
        const newLastIndex = segment.startBarIndex + remainingLen - 1;
        const updated = [...mainBars(next)];
        if (updated[newLastIndex] !== undefined) {
          updated[newLastIndex] = setBarSegmentBreakAfter(updated[newLastIndex], true);
          next = replaceMainBars(next, updated);
        }
      }
    }
  }

  return next;
}

export function setSegmentMeter(song: Song, segment: TimelineSegment, meter: Meter): Song {
  const bars = mainBars(song);

  return bars
    .slice(segment.startBarIndex, segment.endBarIndex + 1)
    .reduce((current, bar) => updateBarMeter(current, bar.id, meter), song);
}

export function setSegmentMeterLabel(song: Song, segment: TimelineSegment, label: string): Song {
  const [numeratorText, denominatorText] = label.split('/');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);

  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    return song;
  }

  return setSegmentMeter(song, segment, createMeter(numerator, denominator));
}

/** BPM override is optional metadata on bars — clears inherit song defaultBpm. */
export function setSegmentBpmOverride(
  song: Song,
  segment: TimelineSegment,
  bpm: number | null,
): Song {
  const bars = mainBars(song);

  return bars
    .slice(segment.startBarIndex, segment.endBarIndex + 1)
    .reduce((current, bar) => updateBarBpm(current, bar.id, bpm), song);
}

function accentForPreset(presetId: string, beatCount: number): SongAccentPattern {
  if (presetId === 'all') {
    return createAccentPatternSteps(Array.from({ length: beatCount }, () => true));
  }

  if (presetId === 'grouped-322') {
    return createAccentPatternGrouped([3, 2, 2]);
  }

  return downbeatAccentPattern(beatCount);
}

function mapBarInSegment(
  song: Song,
  segment: TimelineSegment,
  mapper: (bar: Bar) => Bar,
): Song {
  const section = song.sections[0];
  if (section === undefined) {
    return song;
  }

  const targetIds = new Set(
    section.bars.slice(segment.startBarIndex, segment.endBarIndex + 1).map((bar) => bar.id),
  );

  return {
    ...song,
    updatedAt: Date.now(),
    sections: [
      {
        ...section,
        bars: section.bars.map((bar) => (targetIds.has(bar.id) ? mapper(bar) : bar)),
      },
      ...song.sections.slice(1),
    ],
  };
}

/** Accent pattern editing — visual/metadata; persisted on bars in segment. */
export function setSegmentAccentPreset(
  song: Song,
  segment: TimelineSegment,
  presetId: string,
): Song {
  return mapBarInSegment(song, segment, (bar) => ({
    ...bar,
    accentPattern: accentForPreset(presetId, bar.meter.numerator),
  }));
}

/**
 * Apply a flat accent flag array to every bar in the segment.
 * Length is padded/truncated to each bar's meter numerator.
 */
export function setSegmentAccentPattern(
  song: Song,
  segment: TimelineSegment,
  steps: readonly boolean[],
): Song {
  return mapBarInSegment(song, segment, (bar) => ({
    ...bar,
    accentPattern: createAccentPatternSteps(
      Array.from({ length: bar.meter.numerator }, (_, beatIndex) => steps[beatIndex] ?? false),
    ),
  }));
}

/**
 * Insert a full copy of [segment] immediately after it.
 * New bars get unique IDs; a segment break keeps same-meter duplicates separate.
 * Returns the updated song and the new segment's start bar index (for focus).
 */
export function duplicateSegment(
  song: Song,
  segment: TimelineSegment,
): { song: Song; duplicatedStartBarIndex: number } {
  const section = song.sections[0];
  if (section === undefined) {
    return { song, duplicatedStartBarIndex: segment.startBarIndex };
  }

  const sourceBars = section.bars.slice(segment.startBarIndex, segment.endBarIndex + 1);
  if (sourceBars.length === 0) {
    return { song, duplicatedStartBarIndex: segment.startBarIndex };
  }

  const clones = sourceBars.map((bar) => cloneBarWithNewId(bar));
  const insertAt = segment.endBarIndex + 1;
  const bars = [...section.bars];

  // Keep the original region separate from the duplicate when meters match.
  bars[segment.endBarIndex] = setBarSegmentBreakAfter(bars[segment.endBarIndex], true);
  bars.splice(insertAt, 0, ...clones);

  return {
    song: replaceMainBars(song, bars),
    duplicatedStartBarIndex: insertAt,
  };
}

/**
 * Remove every bar in [segment]. Refuses when it would leave the song empty.
 * Returns focusStartBarIndex for the segment that should be selected next.
 */
export function deleteSegment(
  song: Song,
  segment: TimelineSegment,
): { song: Song; focusStartBarIndex: number | null; blockedReason?: string } {
  const section = song.sections[0];
  if (section === undefined) {
    return { song, focusStartBarIndex: null };
  }

  const segments = buildTimelineSegments(song);
  if (segments.length <= 1) {
    return {
      song,
      focusStartBarIndex: null,
      blockedReason: 'Every song must contain at least one segment.',
    };
  }

  const hasNext = segment.endBarIndex + 1 < section.bars.length;
  const previous = segments.find((item) => item.endBarIndex === segment.startBarIndex - 1);
  const focusStartBarIndex = hasNext
    ? segment.startBarIndex
    : (previous?.startBarIndex ?? segments[0]?.startBarIndex ?? 0);

  const bars = [
    ...section.bars.slice(0, segment.startBarIndex),
    ...section.bars.slice(segment.endBarIndex + 1),
  ];

  return {
    song: replaceMainBars(song, bars),
    focusStartBarIndex,
  };
}
