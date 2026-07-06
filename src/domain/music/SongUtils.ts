import { cloneSongAccentPattern } from './AccentPattern';
import { type Bar } from './Bar';
import { cloneMeter } from './Meter';
import { type Section } from './Section';
import { type Song } from './Song';
import { cloneTempoEvent } from './TempoEvent';

function cloneBar(bar: Bar): Bar {
  return {
    id: bar.id,
    meter: cloneMeter(bar.meter),
    accentPattern: cloneSongAccentPattern(bar.accentPattern),
    repeatCount: bar.repeatCount,
    ...(bar.tempo === undefined ? {} : { tempo: cloneTempoEvent(bar.tempo) }),
  };
}

function cloneSection(section: Section): Section {
  return {
    id: section.id,
    name: section.name,
    loop: section.loop,
    bars: section.bars.map(cloneBar),
  };
}

/** Deep copy of a song document (safe for editor undo / optimistic UI). */
export function cloneSong(song: Song): Song {
  return {
    id: song.id,
    name: song.name,
    sections: song.sections.map(cloneSection),
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
  };
}

/**
 * Linear bar list in score order.
 * Expands each bar's repeatCount (same Bar reference repeated per repeat).
 */
export function flattenSongToBars(song: Song): Bar[] {
  const result: Bar[] = [];

  for (const section of song.sections) {
    for (const bar of section.bars) {
      for (let repeat = 0; repeat < bar.repeatCount; repeat += 1) {
        result.push(bar);
      }
    }
  }

  return result;
}

/** Total logical bars including repeatCount expansion. */
export function getTotalBars(song: Song): number {
  let total = 0;

  for (const section of song.sections) {
    for (const bar of section.bars) {
      total += bar.repeatCount;
    }
  }

  return total;
}

export function findBarById(song: Song, id: string): Bar | undefined {
  for (const section of song.sections) {
    const bar = section.bars.find((candidate) => candidate.id === id);
    if (bar !== undefined) {
      return bar;
    }
  }

  return undefined;
}

export function findSectionById(song: Song, id: string): Section | undefined {
  return song.sections.find((section) => section.id === id);
}

/** Flattened bar with document location (for future seek-to-bar). */
export type LocatedBar = {
  readonly section: Section;
  readonly sectionIndex: number;
  readonly bar: Bar;
  readonly barIndexInSection: number;
  readonly globalBarIndex: number;
  readonly repeatIndex: number;
};

/**
 * Ordered bar instances with section/global indices.
 * Supports meter transitions (7/8 → 4/4 → 13/16) and loop metadata on sections.
 */
export function locateBarsInSong(song: Song): LocatedBar[] {
  const located: LocatedBar[] = [];
  let globalBarIndex = 0;

  song.sections.forEach((section, sectionIndex) => {
    section.bars.forEach((bar, barIndexInSection) => {
      for (let repeatIndex = 0; repeatIndex < bar.repeatCount; repeatIndex += 1) {
        located.push({
          section,
          sectionIndex,
          bar,
          barIndexInSection,
          globalBarIndex,
          repeatIndex,
        });
        globalBarIndex += 1;
      }
    });
  });

  return located;
}
