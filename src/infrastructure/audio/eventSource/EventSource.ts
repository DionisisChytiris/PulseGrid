import type { PlaybackEvent } from '../../../domain/music/compiler/PlaybackEvent';

/**
 * Supplies compiled score ticks in deterministic order.
 * Mirrors the native EventSource contract for tests and offline validation.
 */
export interface EventSource {
  nextEvent(): PlaybackEvent | null;
  peekEvent(offset?: number): PlaybackEvent | null;
  reset(): void;
  readonly eventCount: number | null;
}
