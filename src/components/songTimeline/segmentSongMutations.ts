import {
  createAccentPatternGrouped,
  createAccentPatternSteps,
  cloneSongAccentPattern,
  downbeatAccentPattern,
  type SongAccentPattern,
} from '../../domain/music/AccentPattern';
import { cloneBarTempoFields, createBar, type Bar } from '../../domain/music/Bar';
import {
  normalizeBarSubdivisionForMeter,
} from '../../domain/music/barSubdivision';
import { cloneClickPattern } from '../../domain/music/ClickPattern';
import {
  addBarToSong,
  updateBarBpm,
  updateBarMeter,
  updateBarSubdivision,
} from '../../domain/music/editor';
import { cloneMeter, createMeter, metersEqual, type Meter } from '../../domain/music/Meter';
import type { Song } from '../../domain/music/Song';
import { generateEntityId } from '../../domain/music/storage/generateEntityId';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

import { buildTimelineSegments } from './buildTimelineSegments';
import type { TimelineSegment } from './types';

function allBars(song: Song): Bar[] {
  const bars: Bar[] = [];
  for (const section of song.sections) {
    bars.push(...section.bars);
  }
  return bars;
}

function locateGlobalIndex(
  song: Song,
  globalIndex: number,
): { sectionIndex: number; barIndex: number } | null {
  if (globalIndex < 0) {
    return null;
  }

  let remaining = globalIndex;
  for (let sectionIndex = 0; sectionIndex < song.sections.length; sectionIndex += 1) {
    const section = song.sections[sectionIndex];
    if (remaining < section.bars.length) {
      return { sectionIndex, barIndex: remaining };
    }
    remaining -= section.bars.length;
  }

  return null;
}

function replaceSectionBars(song: Song, sectionIndex: number, bars: readonly Bar[]): Song {
  const section = song.sections[sectionIndex];
  if (section === undefined) {
    return song;
  }

  const sections = [...song.sections];
  sections[sectionIndex] = { ...section, bars };
  return {
    ...song,
    updatedAt: Date.now(),
    sections,
  };
}

function pruneEmptySections(song: Song): Song {
  const sections = song.sections.filter((section) => section.bars.length > 0);
  if (sections.length === 0 || sections.length === song.sections.length) {
    return song;
  }

  return {
    ...song,
    updatedAt: Date.now(),
    sections,
  };
}

function insertBarsAtGlobalIndex(song: Song, globalIndex: number, inserted: readonly Bar[]): Song {
  const located = locateGlobalIndex(song, globalIndex);
  if (located === null) {
    const lastIndex = song.sections.length - 1;
    if (lastIndex < 0) {
      return addBarToSong(song, inserted[0]?.meter ?? createMeter(4, 4));
    }

    return replaceSectionBars(song, lastIndex, [...song.sections[lastIndex].bars, ...inserted]);
  }

  const section = song.sections[located.sectionIndex];
  const bars = [...section.bars];
  bars.splice(located.barIndex, 0, ...inserted);
  return replaceSectionBars(song, located.sectionIndex, bars);
}

function removeBarById(song: Song, barId: string): Song {
  const next = {
    ...song,
    updatedAt: Date.now(),
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.filter((bar) => bar.id !== barId),
    })),
  };

  return pruneEmptySections(next);
}

function setBarSegmentBreakAfter(bar: Bar, segmentBreakAfter: boolean): Bar {
  if (segmentBreakAfter) {
    return { ...bar, segmentBreakAfter: true };
  }

  const { segmentBreakAfter: _removed, ...rest } = bar;
  return rest;
}

/** Clone a bar with a new unique id — copies meter, accents, tempo, click pattern, subdivision. */
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
    ...(bar.subdivision === undefined ? {} : { subdivision: bar.subdivision }),
  });
}

function insertBarAtIndex(song: Song, index: number, meter: Meter): Song {
  const newBar = createBar({
    id: generateEntityId('bar'),
    meter,
    accentPattern: downbeatAccentPattern(meter.numerator),
  });

  return insertBarsAtGlobalIndex(song, Math.max(0, index), [newBar]);
}

/**
 * Length of the UI segment starting at [startBarIndex], stopping at meter
 * change or `segmentBreakAfter` (inclusive of the break bar).
 */
function segmentRunLength(song: Song, startBarIndex: number, meter: Meter): number {
  const bars = allBars(song);
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
    const bars = allBars(next);
    const lastBar = bars[lastIndex];
    const insertAt = lastIndex + 1;
    const hadBreak = lastBar?.segmentBreakAfter === true;

    next = insertBarAtIndex(next, insertAt, segment.meter);

    if (hadBreak && lastBar !== undefined) {
      const lastLocated = locateGlobalIndex(next, lastIndex);
      const insertLocated = locateGlobalIndex(next, insertAt);
      if (lastLocated !== null && insertLocated !== null) {
        let updated = replaceSectionBars(
          next,
          lastLocated.sectionIndex,
          next.sections[lastLocated.sectionIndex].bars.map((bar, index) =>
            index === lastLocated.barIndex ? setBarSegmentBreakAfter(bar, false) : bar,
          ),
        );
        const insertSection = updated.sections[insertLocated.sectionIndex];
        updated = replaceSectionBars(
          updated,
          insertLocated.sectionIndex,
          insertSection.bars.map((bar, index) =>
            index === insertLocated.barIndex ? setBarSegmentBreakAfter(bar, true) : bar,
          ),
        );
        next = updated;
      }
    }
  }

  while (segmentRunLength(next, segment.startBarIndex, segment.meter) > safeCount) {
    const bars = allBars(next);
    const runLen = segmentRunLength(next, segment.startBarIndex, segment.meter);
    const removeIndex = segment.startBarIndex + runLen - 1;
    const removed = bars[removeIndex];
    const barId = removed?.id;

    if (barId === undefined) {
      break;
    }

    const hadBreak = removed.segmentBreakAfter === true;
    next = removeBarById(next, barId);

    if (hadBreak) {
      const remainingLen = segmentRunLength(next, segment.startBarIndex, segment.meter);
      if (remainingLen > 0) {
        const newLastIndex = segment.startBarIndex + remainingLen - 1;
        const located = locateGlobalIndex(next, newLastIndex);
        if (located !== null) {
          next = replaceSectionBars(
            next,
            located.sectionIndex,
            next.sections[located.sectionIndex].bars.map((bar, index) =>
              index === located.barIndex ? setBarSegmentBreakAfter(bar, true) : bar,
            ),
          );
        }
      }
    }
  }

  return next;
}

export function setSegmentMeter(song: Song, segment: TimelineSegment, meter: Meter): Song {
  return segment.barIds.reduce((current, barId) => updateBarMeter(current, barId, meter), song);
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
  return segment.barIds.reduce((current, barId) => updateBarBpm(current, barId, bpm), song);
}

/** Applies Quick Metronome subdivision to every bar in the segment (/2 and /4 only). */
export function setSegmentSubdivision(
  song: Song,
  segment: TimelineSegment,
  subdivision: SubdivisionKind,
): Song {
  const stored = normalizeBarSubdivisionForMeter(segment.meter.denominator, subdivision) ?? null;

  return segment.barIds.reduce(
    (current, barId) => updateBarSubdivision(current, barId, stored),
    song,
  );
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
  const targetIds = new Set(segment.barIds);

  return {
    ...song,
    updatedAt: Date.now(),
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.map((bar) => (targetIds.has(bar.id) ? mapper(bar) : bar)),
    })),
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
  const sourceBars = allBars(song).filter((bar) => segment.barIds.includes(bar.id));
  if (sourceBars.length === 0) {
    return { song, duplicatedStartBarIndex: segment.startBarIndex };
  }

  const clones = sourceBars.map((bar) => cloneBarWithNewId(bar));
  const insertAt = segment.endBarIndex + 1;
  const endLocated = locateGlobalIndex(song, segment.endBarIndex);
  let next = song;

  if (endLocated !== null) {
    next = replaceSectionBars(
      next,
      endLocated.sectionIndex,
      next.sections[endLocated.sectionIndex].bars.map((bar, index) =>
        index === endLocated.barIndex ? setBarSegmentBreakAfter(bar, true) : bar,
      ),
    );
  }

  next = insertBarsAtGlobalIndex(next, insertAt, clones);

  return {
    song: next,
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
  const segments = buildTimelineSegments(song);
  if (segments.length <= 1) {
    return {
      song,
      focusStartBarIndex: null,
      blockedReason: 'Every timeline must contain at least one segment.',
    };
  }

  const totalBars = allBars(song).length;
  const hasNext = segment.endBarIndex + 1 < totalBars;
  const previous = segments.find((item) => item.endBarIndex === segment.startBarIndex - 1);
  const focusStartBarIndex = hasNext
    ? segment.startBarIndex
    : (previous?.startBarIndex ?? segments[0]?.startBarIndex ?? 0);

  const removeIds = new Set(segment.barIds);
  const next = pruneEmptySections({
    ...song,
    updatedAt: Date.now(),
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.filter((bar) => !removeIds.has(bar.id)),
    })),
  });

  if (allBars(next).length === 0) {
    return {
      song,
      focusStartBarIndex: null,
      blockedReason: 'Every timeline must contain at least one segment.',
    };
  }

  return {
    song: next,
    focusStartBarIndex,
  };
}
