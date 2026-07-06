import type { SongAccentPattern } from '../AccentPattern';
import type { Bar } from '../Bar';
import type { Meter } from '../Meter';
import type { Section } from '../Section';
import type { Song } from '../Song';
import { locateBarsInSong } from '../SongUtils';
import {
  createCompiledPlaybackSequence,
  type CompiledPlaybackMetadata,
  type CompiledPlaybackSequence,
} from './CompiledPlaybackSequence';
import type { PlaybackEvent, PlaybackEventSource } from './PlaybackEvent';

export const DEFAULT_COMPILE_BPM = 120;

export type CompileSongOptions = {
  readonly defaultBpm?: number;
};

/** Mutable compile state carried across bars (not mutated on input Song). */
export type BarCompileContext = {
  readonly section: Section;
  readonly sectionId: string;
  readonly globalBarIndex: number;
  readonly repeatIndex: number;
  readonly bpm: number;
  readonly tempoChangedOnThisBar: boolean;
  readonly startingSequence: number;
  readonly startingGlobalTickIndex: number;
};

function assertPositiveBpm(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive number');
  }
}

function resolveAccentFlags(
  pattern: SongAccentPattern,
  beatCount: number,
): readonly boolean[] {
  if (beatCount <= 0) {
    throw new RangeError('Beat count must be positive');
  }

  if (pattern.kind === 'steps') {
    return Array.from({ length: beatCount }, (_, beatIndex) => {
      return pattern.steps[beatIndex % pattern.steps.length] ?? false;
    });
  }

  const accentGroupStarts = pattern.accentGroupStarts ?? true;
  const fromGroups: boolean[] = [];

  for (const groupSize of pattern.groups) {
    for (let pulse = 0; pulse < groupSize; pulse += 1) {
      fromGroups.push(accentGroupStarts && pulse === 0);
    }
  }

  if (fromGroups.length === beatCount) {
    return fromGroups;
  }

  if (fromGroups.length > beatCount) {
    return fromGroups.slice(0, beatCount);
  }

  return Array.from({ length: beatCount }, (_, beatIndex) => {
    return fromGroups[beatIndex % fromGroups.length] ?? false;
  });
}

/**
 * Effective BPM at a global bar index (after repeat expansion).
 * Tempo on a bar applies from that bar onward until the next override.
 */
export function resolveTempoAtPosition(
  song: Song,
  globalBarIndex: number,
  defaultBpm: number = DEFAULT_COMPILE_BPM,
): number {
  assertPositiveBpm(defaultBpm);

  if (globalBarIndex < 0) {
    throw new RangeError('globalBarIndex must be non-negative');
  }

  const locatedBars = locateBarsInSong(song);
  if (locatedBars.length === 0) {
    return defaultBpm;
  }

  const clampedIndex = Math.min(globalBarIndex, locatedBars.length - 1);
  let resolvedBpm = defaultBpm;

  for (let index = 0; index <= clampedIndex; index += 1) {
    const tempo = locatedBars[index].bar.tempo;
    if (tempo !== undefined) {
      resolvedBpm = tempo.bpm;
    }
  }

  return resolvedBpm;
}

/** Expands one bar instance into primary-beat ticks. */
export function expandBarToEvents(bar: Bar, context: BarCompileContext): PlaybackEvent[] {
  const beatCount = bar.meter.numerator;
  const accentFlags = resolveAccentFlags(bar.accentPattern, beatCount);
  const source: PlaybackEventSource = context.tempoChangedOnThisBar ? 'tempoEvent' : 'song';
  const events: PlaybackEvent[] = [];

  for (let beatIndexInBar = 0; beatIndexInBar < beatCount; beatIndexInBar += 1) {
    const sequence = context.startingSequence + beatIndexInBar;
    const globalTickIndex = context.startingGlobalTickIndex + beatIndexInBar;

    events.push({
      sequence,
      barId: bar.id,
      sectionId: context.sectionId,
      meter: bar.meter,
      bpm: context.bpm,
      accent: accentFlags[beatIndexInBar] ?? false,
      subdivisionIndex: 0,
      globalTickIndex,
      source,
      repeatIndex: context.repeatIndex,
      beatIndexInBar,
      globalBarIndex: context.globalBarIndex,
    });
  }

  return events;
}

/** Linear playback events in score order (no metadata wrapper). */
export function flattenToEventStream(
  song: Song,
  options: CompileSongOptions = {},
): PlaybackEvent[] {
  return compileSong(song, options).events;
}

export function compileSong(
  song: Song,
  options: CompileSongOptions = {},
): CompiledPlaybackSequence {
  const defaultBpm = options.defaultBpm ?? DEFAULT_COMPILE_BPM;
  assertPositiveBpm(defaultBpm);

  const locatedBars = locateBarsInSong(song);
  const events: PlaybackEvent[] = [];
  let currentBpm = defaultBpm;
  let sequence = 0;
  let globalTickIndex = 0;

  for (const located of locatedBars) {
    const tempo = located.bar.tempo;
    const tempoChangedOnThisBar = tempo !== undefined;
    if (tempoChangedOnThisBar) {
      currentBpm = tempo.bpm;
    }

    const context: BarCompileContext = {
      section: located.section,
      sectionId: located.section.id,
      globalBarIndex: located.globalBarIndex,
      repeatIndex: located.repeatIndex,
      bpm: currentBpm,
      tempoChangedOnThisBar,
      startingSequence: sequence,
      startingGlobalTickIndex: globalTickIndex,
    };

    const barEvents = expandBarToEvents(located.bar, context);
    events.push(...barEvents);
    sequence += barEvents.length;
    globalTickIndex += barEvents.length;
  }

  const metadata: CompiledPlaybackMetadata = {
    songId: song.id,
    songName: song.name,
    totalBars: locatedBars.length,
    totalSections: song.sections.length,
    defaultBpm,
    loopingSectionIds: song.sections.filter((section) => section.loop).map((section) => section.id),
  };

  return createCompiledPlaybackSequence(events, metadata);
}
