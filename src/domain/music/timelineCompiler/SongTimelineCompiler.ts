import type { Bar } from '../Bar';
import type { Song } from '../Song';
import { locateBarsInSong } from '../SongUtils';
import {
  createTempoDefinitionForMeter,
  type TempoDefinition,
} from '../TempoDefinition';
import type { SubdivisionKind } from '../../valueObjects/Subdivision';
import { computePulseDurationNs } from '../tempo/beatDuration';
import { createMeter, inferPulseBeatUnitFromMeter } from '../Meter';
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

function resolveTempoDefinitionForBar(
  bar: Bar,
  current: TempoDefinition,
): TempoDefinition {
  if (bar.tempoDefinition !== undefined) {
    return bar.tempoDefinition;
  }

  return createTempoDefinitionForMeter(current.bpm, bar.meter);
}

function expandBarToTimelineEvents(
  bar: Bar,
  sectionId: string,
  tempoDefinition: TempoDefinition,
  startingSequenceIndex: number,
  subdivision: SubdivisionKind,
): TimelinePlaybackEvent[] {
  const beatsPerBar = bar.meter.numerator;
  const beatDurationNs = computePulseDurationNs(
    tempoDefinition,
    inferPulseBeatUnitFromMeter(bar.meter),
  );
  const events: TimelinePlaybackEvent[] = [];

  for (let beatIndexInBar = 0; beatIndexInBar < beatsPerBar; beatIndexInBar += 1) {
    events.push({
      sequenceIndex: startingSequenceIndex + beatIndexInBar,
      scheduledBpm: tempoDefinition.bpm,
      beatDurationNs,
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
 * Pulse durations are derived from TempoDefinition.beatUnit and the bar's pulse beat unit.
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
  let sequenceIndex = 0;

  const firstMeter = locatedBars[0]?.bar.meter ?? createMeter(4, 4);
  let currentTempoDefinition = createTempoDefinitionForMeter(defaultBpm, firstMeter);

  for (const located of locatedBars) {
    currentTempoDefinition = resolveTempoDefinitionForBar(located.bar, currentTempoDefinition);

    const barEvents = expandBarToTimelineEvents(
      located.bar,
      located.section.id,
      currentTempoDefinition,
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
        `beatNs=${event.beatDurationNs} beats=${event.beatsPerBar} subdiv=${event.subdivision} ` +
        `bar=${event.barId} section=${event.sectionId}`,
    );
  }
}
