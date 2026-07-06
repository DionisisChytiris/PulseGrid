import type { SongAccentPattern } from '../AccentPattern';
import type { Bar } from '../Bar';
import { createBar } from '../Bar';
import { createMeter, type Meter } from '../Meter';
import { createSection, type Section } from '../Section';
import { createSong, type Song } from '../Song';
import { createTempoEvent, type TempoEvent } from '../TempoEvent';

type StoredMeter = {
  numerator: number;
  denominator: number;
};

type StoredAccentPattern =
  | { kind: 'steps'; steps: boolean[] }
  | { kind: 'grouped'; groups: number[]; accentGroupStarts?: boolean };

type StoredTempoEvent = {
  bpm: number;
  type: 'instant' | 'linear';
  metadata?: Record<string, string | number | boolean>;
};

type StoredBar = {
  id: string;
  meter: StoredMeter;
  accentPattern: StoredAccentPattern;
  tempo?: StoredTempoEvent;
  repeatCount: number;
};

type StoredSection = {
  id: string;
  name: string;
  loop: boolean;
  bars: StoredBar[];
};

export type StoredSong = {
  id: string;
  name: string;
  sections: StoredSection[];
  createdAt: number;
  updatedAt: number;
};

function parseMeter(value: StoredMeter): Meter {
  return createMeter(value.numerator, value.denominator);
}

function parseAccentPattern(value: StoredAccentPattern): SongAccentPattern {
  if (value.kind === 'steps') {
    return { kind: 'steps', steps: [...value.steps] };
  }

  return {
    kind: 'grouped',
    groups: [...value.groups],
    accentGroupStarts: value.accentGroupStarts ?? true,
  };
}

function parseTempo(value: StoredTempoEvent | undefined): TempoEvent | undefined {
  if (value === undefined) {
    return undefined;
  }

  return createTempoEvent(value.bpm, value.type, value.metadata);
}

function parseBar(value: StoredBar): Bar {
  return createBar({
    id: value.id,
    meter: parseMeter(value.meter),
    accentPattern: parseAccentPattern(value.accentPattern),
    repeatCount: value.repeatCount,
    tempo: parseTempo(value.tempo),
  });
}

function parseSection(value: StoredSection): Section {
  return createSection({
    id: value.id,
    name: value.name,
    loop: value.loop,
    bars: value.bars.map(parseBar),
  });
}

export function songToStored(song: Song): StoredSong {
  return {
    id: song.id,
    name: song.name,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    sections: song.sections.map((section) => ({
      id: section.id,
      name: section.name,
      loop: section.loop,
      bars: section.bars.map((bar) => ({
        id: bar.id,
        meter: { numerator: bar.meter.numerator, denominator: bar.meter.denominator },
        accentPattern:
          bar.accentPattern.kind === 'steps'
            ? { kind: 'steps', steps: [...bar.accentPattern.steps] }
            : {
                kind: 'grouped',
                groups: [...bar.accentPattern.groups],
                accentGroupStarts: bar.accentPattern.accentGroupStarts ?? true,
              },
        repeatCount: bar.repeatCount,
        ...(bar.tempo === undefined
          ? {}
          : {
              tempo: {
                bpm: bar.tempo.bpm,
                type: bar.tempo.type,
                ...(bar.tempo.metadata === undefined ? {} : { metadata: { ...bar.tempo.metadata } }),
              },
            }),
      })),
    })),
  };
}

export function storedToSong(value: StoredSong): Song {
  return createSong({
    id: value.id,
    name: value.name,
    sections: value.sections.map(parseSection),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

export function parseStoredSongs(raw: string): Song[] {
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error('Stored songs payload must be an array');
  }

  return parsed.map((entry) => storedToSong(entry as StoredSong));
}

export function serializeStoredSongs(songs: readonly Song[]): string {
  return JSON.stringify(songs.map(songToStored));
}
