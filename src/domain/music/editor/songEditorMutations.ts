import { downbeatAccentPattern } from '../AccentPattern';
import { createBar, type Bar } from '../Bar';
import { createMeter, formatMeter, type Meter } from '../Meter';
import { createSection, type Section } from '../Section';
import type { Song } from '../Song';
import { cloneSong } from '../SongUtils';
import { createTempoEvent } from '../TempoEvent';
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
  return touchSong({ ...song, name: name.trim() || 'Untitled Song' });
}

export function addBarToSong(song: Song, meter: Meter = createMeter(4, 4)): Song {
  const section = ensureMainSection(song);
  const newBar = createBar({
    id: generateEntityId('bar'),
    meter,
    accentPattern: downbeatAccentPattern(meter.numerator),
  });

  return withMainSection(song, {
    ...section,
    bars: [...section.bars, newBar],
  });
}

export function deleteBarFromSong(song: Song, barId: string): Song {
  const section = ensureMainSection(song);

  return withMainSection(song, {
    ...section,
    bars: section.bars.filter((bar) => bar.id !== barId),
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
  return mapBar(song, barId, (bar) => ({
    ...bar,
    meter,
    accentPattern: downbeatAccentPattern(meter.numerator),
  }));
}

export function updateBarBpm(song: Song, barId: string, bpm: number | null): Song {
  return mapBar(song, barId, (bar) =>
    createBar({
      id: bar.id,
      meter: bar.meter,
      accentPattern: bar.accentPattern,
      repeatCount: bar.repeatCount,
      ...(bpm !== null && Number.isFinite(bpm) && bpm > 0 ? { tempo: createTempoEvent(bpm) } : {}),
    }),
  );
}

function mapBar(song: Song, barId: string, mapper: (bar: Bar) => Bar): Song {
  const section = ensureMainSection(song);

  return withMainSection(song, {
    ...section,
    bars: section.bars.map((bar) => (bar.id === barId ? mapper(bar) : bar)),
  });
}

export function cloneEditableSong(song: Song): Song {
  return cloneSong(song);
}
