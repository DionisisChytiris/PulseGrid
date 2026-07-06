import type { CompiledPlaybackSequence } from './CompiledPlaybackSequence';
import type { PlaybackEvent } from './PlaybackEvent';
import { createCompiledPlaybackSequence } from './CompiledPlaybackSequence';

/** Returns a suffix of a compiled sequence with sequences renumbered from zero. */
export function sliceCompiledPlaybackSequence(
  compiled: CompiledPlaybackSequence,
  startIndex: number,
): CompiledPlaybackSequence {
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new RangeError('startIndex must be a non-negative integer');
  }

  if (startIndex >= compiled.events.length) {
    return createCompiledPlaybackSequence([], {
      ...compiled.metadata,
      totalBars: 0,
    });
  }

  const events: PlaybackEvent[] = compiled.events.slice(startIndex).map((event, index) => ({
    ...event,
    sequence: index,
    globalTickIndex: index,
  }));

  const remainingBars = new Set(events.map((event) => event.globalBarIndex)).size;

  return createCompiledPlaybackSequence(events, {
    ...compiled.metadata,
    totalBars: remainingBars,
  });
}
