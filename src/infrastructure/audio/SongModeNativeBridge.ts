import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import {
  createSongPlaybackCursor,
  createSongSchedulerAdapter,
  type SongPlaybackCursor,
  type SongSchedulerAdapter,
} from '../../domain/music/playback';
import type { ScheduledTickSnapshot } from '../../domain/music/playback/ScheduledTickSnapshot';

import { PlaybackMode } from './PlaybackMode';
import NativeAudioModule from './NativeAudioModuleClient';
import {
  serializeCompiledSequenceForNative,
  type NativeTimelinePlaybackEvent,
} from './serializeTimelineForNative';

const SONG_MODE_PREVIEW_COUNT = 10;

export type SongModeSession = {
  readonly compiled: CompiledPlaybackSequence;
  readonly cursor: SongPlaybackCursor;
  readonly adapter: SongSchedulerAdapter;
};

export type SongModeNativeStartOptions = {
  readonly songAdapter?: SongSchedulerAdapter;
  readonly cursor?: SongPlaybackCursor;
  readonly debugLog?: boolean;
};

export type SongModeNativeStartResult = {
  readonly mode: PlaybackMode;
  readonly session: SongModeSession | null;
  readonly timelineEvents: NativeTimelinePlaybackEvent[];
};

function logSongModePreview(snapshots: readonly ScheduledTickSnapshot[]): void {
  const tag = '[MetronomeEngine]';
  const previewCount = Math.min(SONG_MODE_PREVIEW_COUNT, snapshots.length);

  console.log(`${tag} SONG_TIMELINE preview (${previewCount}/${snapshots.length} events)`);

  for (let index = 0; index < previewCount; index += 1) {
    const snapshot = snapshots[index];
    console.log(
      `${tag}   [${index}] seq=${snapshot.sequence} deadlineNs=${snapshot.scheduledDeadlineNs} ` +
        `bpm=${snapshot.bpm} bar=${snapshot.barId} section=${snapshot.sectionId} ` +
        `accent=${snapshot.isAccent} subdiv=${snapshot.subdivisionIndex}`,
    );
  }
}

function assertAdapterMatchesNativeWire(
  adapter: SongSchedulerAdapter,
  timelineEvents: readonly NativeTimelinePlaybackEvent[],
): void {
  const previews = adapter.peekAhead(timelineEvents.length);

  if (previews.length !== timelineEvents.length) {
    throw new Error(
      `SongSchedulerAdapter peekAhead length (${previews.length}) does not match ` +
        `compiled event count (${timelineEvents.length})`,
    );
  }

  for (let index = 0; index < timelineEvents.length; index += 1) {
    const nativeEvent = timelineEvents[index];
    const snapshot = previews[index];

    if (snapshot.sequence !== nativeEvent.sequence) {
      throw new Error(`Adapter/native sequence mismatch at index ${index}`);
    }

    if (snapshot.bpm !== nativeEvent.bpm) {
      throw new Error(`Adapter/native bpm mismatch at index ${index}`);
    }

    if (snapshot.isAccent !== nativeEvent.accent) {
      throw new Error(`Adapter/native accent mismatch at index ${index}`);
    }

    if (snapshot.subdivisionIndex !== nativeEvent.subdivisionIndex) {
      throw new Error(`Adapter/native subdivision mismatch at index ${index}`);
    }

    if (snapshot.barId !== nativeEvent.barId || snapshot.sectionId !== nativeEvent.sectionId) {
      throw new Error(`Adapter/native metadata mismatch at index ${index}`);
    }
  }
}

export function createSongModeSession(
  compiled: CompiledPlaybackSequence,
  options: SongModeNativeStartOptions = {},
): SongModeSession {
  const cursor = options.cursor ?? createSongPlaybackCursor(compiled);
  const adapter =
    options.songAdapter ??
    createSongSchedulerAdapter(cursor, compiled, { debugLog: options.debugLog });

  return { compiled, cursor, adapter };
}

/**
 * Bridges SongSchedulerAdapter output into the native MetronomeEngine SONG_TIMELINE path.
 * Quick Metronome is unaffected — call NativeAudioModule.start() without song fields instead.
 */
export function startSongModeNativePlayback(
  compiled: CompiledPlaybackSequence,
  options: SongModeNativeStartOptions = {},
): SongModeNativeStartResult {
  const tag = '[MetronomeEngine]';

  if (compiled.events.length === 0) {
    console.warn(`${tag} SONG_TIMELINE requested with empty compiled sequence — fallback QUICK_METRONOME`);
    return {
      mode: PlaybackMode.QUICK_METRONOME,
      session: null,
      timelineEvents: [],
    };
  }

  const session = createSongModeSession(compiled, options);
  const { adapter, cursor } = session;
  const timelineEvents = serializeCompiledSequenceForNative(compiled);

  assertAdapterMatchesNativeWire(adapter, timelineEvents);

  if (options.debugLog ?? true) {
    logSongModePreview(adapter.peekAhead(SONG_MODE_PREVIEW_COUNT));
  }

  const firstSnapshot = adapter.snapshotAt(0);
  const firstEvent = compiled.events[0];

  cursor.play();

  console.log(`${tag} Playback mode: SONG_TIMELINE (adapter-fed, events=${timelineEvents.length})`);

  NativeAudioModule.start({
    bpm: firstSnapshot?.bpm ?? firstEvent?.bpm ?? 120,
    beatsPerMeasure: firstSnapshot?.beatsPerMeasure ?? firstEvent?.meter.numerator ?? 4,
    accentPattern: [true],
    subdivision: 'quarter',
    playbackMode: PlaybackMode.SONG_TIMELINE,
    timelineEvents,
  });

  return {
    mode: PlaybackMode.SONG_TIMELINE,
    session,
    timelineEvents,
  };
}

export function stopSongModeSession(session: SongModeSession | null): void {
  session?.cursor.stop();
}
