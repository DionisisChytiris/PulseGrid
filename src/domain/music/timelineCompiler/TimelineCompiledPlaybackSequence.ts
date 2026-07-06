import type { TimelinePlaybackEvent } from './TimelinePlaybackEvent';

export interface TimelineCompiledPlaybackMetadata {
  readonly songId: string;
  readonly songName: string;
  readonly totalBars: number;
  readonly totalSections: number;
  readonly defaultBpm: number;
}

export interface TimelineCompiledPlaybackSequence {
  readonly events: readonly TimelinePlaybackEvent[];
  readonly totalDurationBeats: number;
  readonly metadata: TimelineCompiledPlaybackMetadata;
}

export function createTimelineCompiledPlaybackSequence(
  events: readonly TimelinePlaybackEvent[],
  metadata: TimelineCompiledPlaybackMetadata,
): TimelineCompiledPlaybackSequence {
  return {
    events,
    totalDurationBeats: events.length,
    metadata,
  };
}
