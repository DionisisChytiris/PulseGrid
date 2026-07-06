import type { Bar } from '../Bar';
import type { Song } from '../Song';
import { locateBarsInSong } from '../SongUtils';
import type { SubdivisionKind } from '../../valueObjects/Subdivision';
import {
  createTimelineCompiledPlaybackSequence,
  type TimelineCompiledPlaybackMetadata,
  type TimelineCompiledPlaybackSequence,
} from './TimelineCompiledPlaybackSequence';
import type { TimelinePlaybackEvent } from './TimelinePlaybackEvent';

export const DEFAULT_TIMELINE_COMPILE_BPM = 120;

const DEFAULT_SUBDIVISION: SubdivisionKind = 'quarter';

export type CompileTimelineSongOptions = {
  readonly defaultBpm?: number;
  readonly defaultSubdivision?: SubdivisionKind;
};

function assertPositiveBpm(bpm: number): void {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive number');
  }
}

function expandBarToTimelineEvents(
  bar: Bar,
  sectionId: string,
  scheduledBpm: number,
  startingSequenceIndex: number,
  subdivision: SubdivisionKind,
): TimelinePlaybackEvent[] {
  const beatsPerBar = bar.meter.numerator;
  const events: TimelinePlaybackEvent[] = [];

  for (let beatIndexInBar = 0; beatIndexInBar < beatsPerBar; beatIndexInBar += 1) {
    events.push({
      sequenceIndex: startingSequenceIndex + beatIndexInBar,
      scheduledBpm,
      beatsPerBar,
      subdivision,
      accentPattern: bar.accentPattern,
      barId: bar.id,
      sectionId,
    });
  }

  return events;
}

/**
 * Flattens a song document into a deterministic, immutable primary-beat event stream.
 * One event per beat; mixed meters expand via each bar's meter numerator (e.g. 7/8 → 7 events).
 */
export function compileSong(
  song: Song,
  options: CompileTimelineSongOptions = {},
): TimelineCompiledPlaybackSequence {
  const defaultBpm = options.defaultBpm ?? DEFAULT_TIMELINE_COMPILE_BPM;
  const defaultSubdivision = options.defaultSubdivision ?? DEFAULT_SUBDIVISION;
  assertPositiveBpm(defaultBpm);

  const locatedBars = locateBarsInSong(song);
  const events: TimelinePlaybackEvent[] = [];
  let currentBpm = defaultBpm;
  let sequenceIndex = 0;

  for (const located of locatedBars) {
    const tempo = located.bar.tempo;
    if (tempo !== undefined) {
      currentBpm = tempo.bpm;
    }

    const barEvents = expandBarToTimelineEvents(
      located.bar,
      located.section.id,
      currentBpm,
      sequenceIndex,
      defaultSubdivision,
    );

    events.push(...barEvents);
    sequenceIndex += barEvents.length;
  }

  const metadata: TimelineCompiledPlaybackMetadata = {
    songId: song.id,
    songName: song.name,
    totalBars: locatedBars.length,
    totalSections: song.sections.length,
    defaultBpm,
  };

  return createTimelineCompiledPlaybackSequence(events, metadata);
}

/** Logs the first [count] compiled events for debugging (default 10). */
export function logFirstCompiledEvents(
  compiled: TimelineCompiledPlaybackSequence,
  count = 10,
): void {
  const previewCount = Math.min(count, compiled.events.length);
  const tag = '[SongTimelineCompiler]';

  console.log(`${tag} song="${compiled.metadata.songName}" events=${compiled.events.length}`);

  for (let index = 0; index < previewCount; index += 1) {
    const event = compiled.events[index];
    console.log(
      `${tag} [${index}] seq=${event.sequenceIndex} bpm=${event.scheduledBpm} ` +
        `beats=${event.beatsPerBar} subdiv=${event.subdivision} ` +
        `bar=${event.barId} section=${event.sectionId}`,
    );
  }
}
