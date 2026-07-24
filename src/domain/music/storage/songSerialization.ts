import type { SongAccentPattern } from '../AccentPattern';
import type { Bar } from '../Bar';
import { createBar } from '../Bar';
import { ClickAccent, type ClickPattern } from '../ClickPattern';
import { BeatUnit } from '../BeatUnit';
import {
  createMeter,
  defaultMeterGrouping,
  inferTempoBeatUnitFromMeter,
  type Meter,
} from '../Meter';
import { createSection, type Section } from '../Section';
import { createSong, type Song } from '../Song';
import { clampSongBpm, DEFAULT_SONG_BPM } from '../songBpm';
import { createTempoDefinition } from '../TempoDefinition';
import type { TempoTransitionType } from '../TempoEvent';

type StoredMeter = {
  numerator: number;
  denominator: number;
  grouping?: number[];
};

type StoredAccentPattern =
  | { kind: 'steps'; steps: boolean[] }
  | { kind: 'grouped'; groups: number[]; accentGroupStarts?: boolean };

type StoredTempoDefinition = {
  bpm: number;
  beatUnit: BeatUnit;
};

/** Legacy persisted shape (BPM only — beat unit inferred on load). */
type StoredLegacyTempoEvent = {
  bpm: number;
  type: TempoTransitionType;
  metadata?: Record<string, string | number | boolean>;
};

type StoredClickStep = {
  enabled: boolean;
  accent: ClickAccent;
};

type StoredClickPattern = {
  steps: StoredClickStep[];
};

type StoredBar = {
  id: string;
  meter: StoredMeter;
  accentPattern: StoredAccentPattern;
  clickPattern?: StoredClickPattern;
  tempoDefinition?: StoredTempoDefinition;
  tempoTransition?: TempoTransitionType;
  /** @deprecated Legacy field — migrated to tempoDefinition on load. */
  tempo?: StoredLegacyTempoEvent;
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
  /** Optional for backward compatibility — missing values load as DEFAULT_SONG_BPM. */
  defaultBpm?: number;
  sections: StoredSection[];
  createdAt: number;
  updatedAt: number;
};

function parseMeter(value: StoredMeter): Meter {
  const grouping =
    value.grouping === undefined
      ? defaultMeterGrouping(value.numerator, value.denominator)
      : value.grouping;

  return createMeter(value.numerator, value.denominator, grouping);
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

function parseBeatUnit(value: string): BeatUnit {
  if (Object.values(BeatUnit).includes(value as BeatUnit)) {
    return value as BeatUnit;
  }

  throw new Error(`Unknown beat unit: ${value}`);
}

function parseTempoDefinition(
  value: StoredTempoDefinition | undefined,
  legacy: StoredLegacyTempoEvent | undefined,
  meter: Meter,
): { tempoDefinition?: ReturnType<typeof createTempoDefinition>; tempoTransition?: TempoTransitionType } {
  if (value !== undefined) {
    return {
      tempoDefinition: createTempoDefinition(value.bpm, parseBeatUnit(value.beatUnit)),
    };
  }

  if (legacy === undefined) {
    return {};
  }

  return {
    tempoDefinition: createTempoDefinition(legacy.bpm, inferTempoBeatUnitFromMeter(meter)),
    tempoTransition: legacy.type,
  };
}

function parseClickPattern(value: StoredClickPattern): ClickPattern {
  return {
    steps: value.steps.map((step) => ({
      enabled: step.enabled,
      accent: step.accent,
    })),
  };
}

function parseBar(value: StoredBar): Bar {
  const meter = parseMeter(value.meter);
  const { tempoDefinition, tempoTransition } = parseTempoDefinition(
    value.tempoDefinition,
    value.tempo,
    meter,
  );

  return createBar({
    id: value.id,
    meter,
    accentPattern: parseAccentPattern(value.accentPattern),
    repeatCount: value.repeatCount,
    tempoDefinition,
    tempoTransition: value.tempoTransition ?? tempoTransition,
    ...(value.clickPattern === undefined ? {} : { clickPattern: parseClickPattern(value.clickPattern) }),
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
    defaultBpm: song.defaultBpm,
    createdAt: song.createdAt,
    updatedAt: song.updatedAt,
    sections: song.sections.map((section) => ({
      id: section.id,
      name: section.name,
      loop: section.loop,
      bars: section.bars.map((bar) => ({
        id: bar.id,
        meter: {
          numerator: bar.meter.numerator,
          denominator: bar.meter.denominator,
          grouping: [...bar.meter.grouping],
        },
        accentPattern:
          bar.accentPattern.kind === 'steps'
            ? { kind: 'steps', steps: [...bar.accentPattern.steps] }
            : {
                kind: 'grouped',
                groups: [...bar.accentPattern.groups],
                accentGroupStarts: bar.accentPattern.accentGroupStarts ?? true,
              },
        repeatCount: bar.repeatCount,
        ...(bar.clickPattern === undefined
          ? {}
          : {
              clickPattern: {
                steps: bar.clickPattern.steps.map((step) => ({
                  enabled: step.enabled,
                  accent: step.accent,
                })),
              },
            }),
        ...(bar.tempoDefinition === undefined
          ? {}
          : {
              tempoDefinition: {
                bpm: bar.tempoDefinition.bpm,
                beatUnit: bar.tempoDefinition.beatUnit,
              },
              ...(bar.tempoTransition === undefined ? {} : { tempoTransition: bar.tempoTransition }),
            }),
      })),
    })),
  };
}

export function storedToSong(value: StoredSong): Song {
  return createSong({
    id: value.id,
    name: value.name,
    defaultBpm:
      value.defaultBpm === undefined
        ? DEFAULT_SONG_BPM
        : clampSongBpm(value.defaultBpm),
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
