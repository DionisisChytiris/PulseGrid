import { defaultAccentPatternFromMeter } from '../AccentPattern';
import { createBar, type Bar } from '../Bar';
import { normalizeBarSubdivisionForMeter } from '../barSubdivision';
import { createMeter, formatMeter, type Meter } from '../Meter';
import { createSection, type Section } from '../Section';
import type { CountInBars } from '../countIn';
import { normalizeCountInBars } from '../countIn';
import type { Song } from '../Song';
import { clampSongBpm } from '../songBpm';
import { sanitizeSongName } from '../songName';
import { cloneSong } from '../SongUtils';
import { createTempoDefinitionForMeter } from '../TempoDefinition';
import { generateEntityId } from '../storage/generateEntityId';

export const METER_PRESETS: readonly Meter[] = [
  createMeter(4, 4),
  createMeter(3, 4),
  createMeter(7, 8),
  createMeter(13, 16),
];

export function meterPresetLabel(meter: Meter): string {
  return formatMeter(meter);
}

function touchSong(song: Song): Song {
  return {
    ...song,
    updatedAt: Date.now(),
  };
}

function ensureMainSection(song: Song): Section {
  if (song.sections.length > 0) {
    return song.sections[0];
  }

  return createSection({ id: 'main', name: 'Main', bars: [] });
}

function withMainSection(song: Song, section: Section): Song {
  const sections = song.sections.length > 0 ? [...song.sections] : [section];
  sections[0] = section;
  return touchSong({ ...song, sections });
}

export function updateSongName(song: Song, name: string): Song {
  return touchSong({ ...song, name: sanitizeSongName(name) });
}

export function updateSongDefaultBpm(song: Song, bpm: number): Song {
  return touchSong({ ...song, defaultBpm: clampSongBpm(bpm) });
}

export function updateSongCountInBars(song: Song, countInBars: CountInBars): Song {
  return touchSong({ ...song, countInBars: normalizeCountInBars(countInBars) });
}

function withSectionAt(song: Song, sectionIndex: number, section: Section): Song {
  const sections = [...song.sections];
  sections[sectionIndex] = section;
  return touchSong({ ...song, sections });
}

function lastSectionIndex(song: Song): number {
  return Math.max(0, song.sections.length - 1);
}

export function addBarToSong(song: Song, meter: Meter = createMeter(4, 4)): Song {
  const sectionIndex = song.sections.length > 0 ? lastSectionIndex(song) : 0;
  const section =
    song.sections[sectionIndex] ?? createSection({ id: 'main', name: 'Main', bars: [] });
  const newBar = createBar({
    id: generateEntityId('bar'),
    meter,
    accentPattern: defaultAccentPatternFromMeter(meter),
  });

  const nextSection = {
    ...section,
    bars: [...section.bars, newBar],
  };

  if (song.sections.length === 0) {
    return touchSong({ ...song, sections: [nextSection] });
  }

  return withSectionAt(song, sectionIndex, nextSection);
}

export function deleteBarFromSong(song: Song, barId: string): Song {
  return touchSong({
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.filter((bar) => bar.id !== barId),
    })),
  });
}

export function moveBarInSong(song: Song, barId: string, direction: 'up' | 'down'): Song {
  const section = ensureMainSection(song);
  const bars = [...section.bars];
  const index = bars.findIndex((bar) => bar.id === barId);

  if (index < 0) {
    return song;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= bars.length) {
    return song;
  }

  const temp = bars[index];
  bars[index] = bars[targetIndex];
  bars[targetIndex] = temp;

  return withMainSection(song, { ...section, bars });
}

export function updateBarMeter(song: Song, barId: string, meter: Meter): Song {
  return mapBar(song, barId, (bar) => {
    const subdivision = normalizeBarSubdivisionForMeter(meter.denominator, bar.subdivision);
    const { subdivision: _previousSubdivision, ...withoutSubdivision } = bar;

    return {
      ...withoutSubdivision,
      meter,
      accentPattern: defaultAccentPatternFromMeter(meter),
      ...(subdivision === undefined ? {} : { subdivision }),
    };
  });
}

export function updateBarBpm(song: Song, barId: string, bpm: number | null): Song {
  return mapBar(song, barId, (bar) =>
    createBar({
      id: bar.id,
      meter: bar.meter,
      accentPattern: bar.accentPattern,
      repeatCount: bar.repeatCount,
      ...(bar.clickPattern === undefined ? {} : { clickPattern: bar.clickPattern }),
      ...(bar.segmentBreakAfter === true ? { segmentBreakAfter: true } : {}),
      ...(bar.subdivision === undefined ? {} : { subdivision: bar.subdivision }),
      ...(bpm !== null && Number.isFinite(bpm) && bpm > 0
        ? {
            tempoDefinition: createTempoDefinitionForMeter(clampSongBpm(bpm), bar.meter),
            tempoTransition: 'instant',
          }
        : {}),
    }),
  );
}

export function updateBarSubdivision(
  song: Song,
  barId: string,
  subdivision: import('../../valueObjects/Subdivision').SubdivisionKind | null,
): Song {
  return mapBar(song, barId, (bar) => {
    const next =
      subdivision === null
        ? undefined
        : normalizeBarSubdivisionForMeter(bar.meter.denominator, subdivision);
    const { subdivision: _previous, ...withoutSubdivision } = bar;

    return {
      ...withoutSubdivision,
      ...(next === undefined ? {} : { subdivision: next }),
    };
  });
}

function mapBar(song: Song, barId: string, mapper: (bar: Bar) => Bar): Song {
  return touchSong({
    ...song,
    sections: song.sections.map((section) => ({
      ...section,
      bars: section.bars.map((bar) => (bar.id === barId ? mapper(bar) : bar)),
    })),
  });
}

export function cloneEditableSong(song: Song): Song {
  return cloneSong(song);
}
