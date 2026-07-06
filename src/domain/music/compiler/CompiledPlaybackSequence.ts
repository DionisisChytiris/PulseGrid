import type { PlaybackEvent } from './PlaybackEvent';

export interface CompiledPlaybackMetadata {
  readonly songId: string;
  readonly songName: string;
  readonly totalBars: number;
  readonly totalSections: number;
  readonly defaultBpm: number;
  /** Section ids marked loop=true (playback layer interprets looping). */
  readonly loopingSectionIds: readonly string[];
}

export interface CompiledPlaybackSequence {
  readonly events: readonly PlaybackEvent[];
  /** Total primary-beat ticks in the compiled stream. */
  readonly totalDurationBeats: number;
  readonly metadata: CompiledPlaybackMetadata;
}

export function createCompiledPlaybackSequence(
  events: readonly PlaybackEvent[],
  metadata: CompiledPlaybackMetadata,
): CompiledPlaybackSequence {
  return {
    events,
    totalDurationBeats: events.length,
    metadata,
  };
}
