import type { PlaybackEvent } from '../../../domain/music/compiler/PlaybackEvent';
import type { CompiledPlaybackSequence } from '../../../domain/music/compiler/CompiledPlaybackSequence';

import type { EventSource } from './EventSource';

/**
 * Deterministic iterator over a precompiled score stream.
 * Supports peek-ahead for lookahead validation without recomputing the Song.
 */
export class SongTimelineEventSource implements EventSource {
  private cursor = 0;

  private readonly events: readonly PlaybackEvent[];

  constructor(compiled: CompiledPlaybackSequence) {
    this.events = compiled.events;
  }

  get eventCount(): number | null {
    return this.events.length;
  }

  reset(): void {
    this.cursor = 0;
  }

  peekEvent(offset = 0): PlaybackEvent | null {
    const index = this.cursor + offset;
    return this.events[index] ?? null;
  }

  nextEvent(): PlaybackEvent | null {
    const event = this.peekEvent(0);
    if (event) {
      this.cursor += 1;
    }
    return event;
  }
}
