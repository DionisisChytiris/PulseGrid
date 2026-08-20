import {
  defaultAccentPatternFromMeter,
  type SongAccentPattern,
} from '../AccentPattern';
import type { Bar } from '../Bar';
import { createBar } from '../Bar';
import { ClickAccent, type ClickPattern } from '../ClickPattern';
import { BeatUnit } from '../BeatUnit';
import {
  createMeter,
  inferTempoBeatUnitFromMeter,
  type Meter,
} from '../Meter';
import { createSection, type Section } from '../Section';
import { normalizeCountInBars, type CountInBars } from '../countIn';
import { createSong, type Song } from '../Song';
import { clampSongBpm, DEFAULT_SONG_BPM } from '../songBpm';
import { createTempoDefinition } from '../TempoDefinition';
import type { TempoTransitionType } from '../TempoEvent';
import { parseStoredBarSubdivision } from '../barSubdivision';

const LOG_TAG = '[PulseGrid:songs]';

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
  /** Starts a new UI segment after this bar when the next meter matches. */
  segmentBreakAfter?: boolean;
  /**
   * Optional Quick Metronome subdivision (`quarter` | `eighth` | `triplet` | `sixteenth`).
   * Absent on older songs → Quarter.
   */
  subdivision?: string;
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
  /** Optional for backward compatibility — missing values load as 0 (None). */
  countInBars?: CountInBars | number;
  sections: StoredSection[];
  createdAt: number;
  updatedAt: number;
};

export type ParseStoredSongsResult = {
  readonly songs: Song[];
  /** Original JSON entries that could not be recovered as songs. */
  readonly skipped: readonly unknown[];
  /** True when the payload is not valid JSON or is not a song array. */
  readonly unreadable: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function warn(message: string, extra?: unknown): void {
  if (extra === undefined) {
    console.warn(`${LOG_TAG} ${message}`);
    return;
  }

  console.warn(`${LOG_TAG} ${message}`, extra);
}

function parseMeter(value: unknown): Meter | null {
  if (!isRecord(value)) {
    return null;
  }

  const numerator = asFiniteNumber(value.numerator);
  const denominator = asFiniteNumber(value.denominator);

  if (numerator === undefined || denominator === undefined) {
    return null;
  }

  const grouping = Array.isArray(value.grouping) ? value.grouping : undefined;

  try {
    return createMeter(numerator, denominator, grouping);
  } catch {
    try {
      return createMeter(numerator, denominator);
    } catch {
      return null;
    }
  }
}

function parseAccentPattern(value: unknown, meter: Meter): SongAccentPattern {
  if (!isRecord(value)) {
    return defaultAccentPatternFromMeter(meter);
  }

  if (value.kind === 'steps' && Array.isArray(value.steps) && value.steps.length > 0) {
    return {
      kind: 'steps',
      steps: value.steps.map((step) => step === true),
    };
  }

  if (value.kind === 'grouped' && Array.isArray(value.groups) && value.groups.length > 0) {
    const groups = value.groups.filter(
      (size): size is number => typeof size === 'number' && Number.isInteger(size) && size > 0,
    );

    if (groups.length > 0) {
      return {
        kind: 'grouped',
        groups,
        accentGroupStarts: value.accentGroupStarts !== false,
      };
    }
  }

  warn(`Unknown accent pattern on a bar in ${meter.numerator}/${meter.denominator}; using meter grouping defaults.`);
  return defaultAccentPatternFromMeter(meter);
}

function parseBeatUnit(value: unknown, meter: Meter): BeatUnit {
  if (typeof value === 'string' && (Object.values(BeatUnit) as string[]).includes(value)) {
    return value as BeatUnit;
  }

  const inferred = inferTempoBeatUnitFromMeter(meter);
  if (value !== undefined) {
    warn(`Unknown beat unit ${JSON.stringify(value)}; inferred ${inferred} from meter.`);
  }

  return inferred;
}

function parseClickAccent(value: unknown): ClickAccent {
  if (value === ClickAccent.Accent || value === ClickAccent.Normal) {
    return value;
  }

  if (value !== undefined) {
    warn(`Unknown click accent ${JSON.stringify(value)}; using normal.`);
  }

  return ClickAccent.Normal;
}

function parseTempoTransition(value: unknown): TempoTransitionType | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'instant' || value === 'linear') {
    return value;
  }

  warn(`Unknown tempo transition ${JSON.stringify(value)}; using instant.`);
  return 'instant';
}

function parsePositiveBpm(value: unknown): number | undefined {
  const bpm = asFiniteNumber(value);
  if (bpm === undefined || bpm <= 0) {
    return undefined;
  }

  return bpm;
}

function parseTempoDefinition(
  value: unknown,
  legacy: unknown,
  meter: Meter,
): { tempoDefinition?: ReturnType<typeof createTempoDefinition>; tempoTransition?: TempoTransitionType } {
  if (isRecord(value)) {
    const bpm = parsePositiveBpm(value.bpm);
    if (bpm !== undefined) {
      try {
        return {
          tempoDefinition: createTempoDefinition(bpm, parseBeatUnit(value.beatUnit, meter)),
        };
      } catch {
        // Fall through to legacy / omit.
      }
    }
  }

  if (!isRecord(legacy)) {
    return {};
  }

  const legacyBpm = parsePositiveBpm(legacy.bpm);
  if (legacyBpm === undefined) {
    return {};
  }

  try {
    return {
      tempoDefinition: createTempoDefinition(legacyBpm, inferTempoBeatUnitFromMeter(meter)),
      tempoTransition: parseTempoTransition(legacy.type) ?? 'instant',
    };
  } catch {
    return {};
  }
}

function parseClickPattern(value: unknown, meter: Meter): ClickPattern | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length === 0) {
    warn('Dropping unreadable click pattern; playback will use meter defaults.');
    return undefined;
  }

  if (value.steps.length !== meter.numerator) {
    warn(
      `Dropping click pattern whose length (${value.steps.length}) does not match meter numerator (${meter.numerator}).`,
    );
    return undefined;
  }

  return {
    steps: value.steps.map((step) => {
      if (!isRecord(step)) {
        return { enabled: true, accent: ClickAccent.Normal };
      }

      return {
        enabled: step.enabled !== false,
        accent: parseClickAccent(step.accent),
      };
    }),
  };
}

function parseRepeatCount(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1) {
    return value;
  }

  return 1;
}

function parseBar(value: unknown, songId: string): Bar | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asNonEmptyString(value.id);
  const meter = parseMeter(value.meter);

  if (id === undefined || meter === null) {
    warn(`Skipping unreadable bar in timeline ${songId}.`);
    return null;
  }

  const { tempoDefinition, tempoTransition } = parseTempoDefinition(
    value.tempoDefinition,
    value.tempo,
    meter,
  );

  try {
    const subdivision = parseStoredBarSubdivision(value.subdivision);

    return createBar({
      id,
      meter,
      accentPattern: parseAccentPattern(value.accentPattern, meter),
      repeatCount: parseRepeatCount(value.repeatCount),
      tempoDefinition,
      tempoTransition: parseTempoTransition(value.tempoTransition) ?? tempoTransition,
      ...(value.clickPattern === undefined
        ? {}
        : { clickPattern: parseClickPattern(value.clickPattern, meter) }),
      ...(value.segmentBreakAfter === true ? { segmentBreakAfter: true } : {}),
      ...(subdivision === undefined ? {} : { subdivision }),
    });
  } catch (error) {
    warn(`Skipping bar ${id} in timeline ${songId}.`, error);
    return null;
  }
}

function parseSection(value: unknown, songId: string): Section | null {
  if (!isRecord(value)) {
    warn(`Skipping unreadable section in timeline ${songId}.`);
    return null;
  }

  const id = asNonEmptyString(value.id);
  if (id === undefined) {
    warn(`Skipping section without an id in timeline ${songId}.`);
    return null;
  }

  const rawBars = Array.isArray(value.bars) ? value.bars : [];
  const bars = rawBars
    .map((bar) => parseBar(bar, songId))
    .filter((bar): bar is Bar => bar !== null);

  return createSection({
    id,
    name: typeof value.name === 'string' ? value.name : 'Section',
    loop: value.loop === true,
    bars,
  });
}

function parseDefaultBpm(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SONG_BPM;
  }

  return clampSongBpm(value);
}

function parseTimestamp(value: unknown): number | undefined {
  return asFiniteNumber(value);
}

export function songToStored(song: Song): StoredSong {
  return {
    id: song.id,
    name: song.name,
    defaultBpm: song.defaultBpm,
    countInBars: song.countInBars,
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
        ...(bar.segmentBreakAfter === true ? { segmentBreakAfter: true } : {}),
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
        ...(bar.subdivision === undefined ? {} : { subdivision: bar.subdivision }),
      })),
    })),
  };
}

export function storedToSong(value: StoredSong): Song {
  const songId = asNonEmptyString(value.id) ?? 'unknown';
  const sections = Array.isArray(value.sections)
    ? value.sections
        .map((section) => parseSection(section, songId))
        .filter((section): section is Section => section !== null)
    : [];

  return createSong({
    id: value.id,
    name: typeof value.name === 'string' ? value.name : '',
    defaultBpm: parseDefaultBpm(value.defaultBpm),
    // Missing field = pre-count-in timelines → None. New songs default via createSong.
    countInBars:
      value.countInBars === undefined ? 0 : normalizeCountInBars(value.countInBars),
    sections,
    createdAt: parseTimestamp(value.createdAt),
    updatedAt: parseTimestamp(value.updatedAt),
  });
}

function tryParseStoredSong(entry: unknown, index: number): Song | null {
  if (!isRecord(entry)) {
    warn(`Skipping stored timeline at index ${index}: not an object.`);
    return null;
  }

  const id = asNonEmptyString(entry.id);
  if (id === undefined) {
    warn(`Skipping stored timeline at index ${index}: missing id.`);
    return null;
  }

  if (!Array.isArray(entry.sections)) {
    warn(`Skipping stored timeline ${id}: sections is not an array.`);
    return null;
  }

  try {
    return storedToSong(entry as StoredSong);
  } catch (error) {
    warn(`Skipping stored timeline ${id}.`, error);
    return null;
  }
}

export function parseStoredSongs(raw: string): ParseStoredSongsResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    warn('Stored songs JSON is unreadable; loading an empty library.', error);
    return { songs: [], skipped: [], unreadable: true };
  }

  if (!Array.isArray(parsed)) {
    warn('Stored songs payload is not an array; loading an empty library.');
    return { songs: [], skipped: [], unreadable: true };
  }

  const songs: Song[] = [];
  const skipped: unknown[] = [];

  parsed.forEach((entry, index) => {
    const song = tryParseStoredSong(entry, index);
    if (song === null) {
      skipped.push(entry);
      return;
    }

    songs.push(song);
  });

  return { songs, skipped, unreadable: false };
}

export function serializeStoredSongs(
  songs: readonly Song[],
  skippedEntries: readonly unknown[] = [],
): string {
  return JSON.stringify([...songs.map(songToStored), ...skippedEntries]);
}
