import {
  createAccentPatternGrouped,
  createAccentPatternSteps,
  downbeatAccentPattern,
  type SongAccentPattern,
} from '../../domain/music/AccentPattern';
import { createBar, type Bar } from '../../domain/music/Bar';
import {
  addBarToSong,
  deleteBarFromSong,
  updateBarBpm,
  updateBarMeter,
} from '../../domain/music/editor';
import { createMeter, metersEqual, type Meter } from '../../domain/music/Meter';
import type { Song } from '../../domain/music/Song';
import { generateEntityId } from '../../domain/music/storage/generateEntityId';

import type { TimelineSegment } from './types';

function mainBars(song: Song) {
  return song.sections[0]?.bars ?? [];
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

  const sections = [...song.sections];
  sections[0] = { ...section, bars };

  return { ...song, sections, updatedAt: Date.now() };
}

function meterRunLength(song: Song, startBarIndex: number, meter: Meter): number {
  const bars = mainBars(song);
  let count = 0;

  for (let index = startBarIndex; index < bars.length; index += 1) {
    if (!metersEqual(bars[index].meter, meter)) {
      break;
    }

    count += 1;
  }

  return count;
}

/** Segment-level bar count — UI/editor only; persists via SongRepository. */
export function setSegmentBarCount(song: Song, segment: TimelineSegment, targetCount: number): Song {
  const safeCount = Math.max(1, Math.floor(targetCount));
  let next = song;

  while (meterRunLength(next, segment.startBarIndex, segment.meter) < safeCount) {
    const runLen = meterRunLength(next, segment.startBarIndex, segment.meter);
    const insertAt = segment.startBarIndex + runLen;
    next = insertBarAtIndex(next, insertAt, segment.meter);
  }

  while (meterRunLength(next, segment.startBarIndex, segment.meter) > safeCount) {
    const bars = mainBars(next);
    const runLen = meterRunLength(next, segment.startBarIndex, segment.meter);
    const removeIndex = segment.startBarIndex + runLen - 1;
    const barId = bars[removeIndex]?.id;

    if (barId === undefined) {
      break;
    }

    next = deleteBarFromSong(next, barId);
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

/** BPM override is optional metadata on bars — does not affect scheduling in this step. */
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
