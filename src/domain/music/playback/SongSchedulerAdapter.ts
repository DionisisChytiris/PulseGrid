import type { CompiledPlaybackSequence } from '../compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../compiler/PlaybackEvent';

import {
  beatDurationNs,
  computeDeadlineOffsets,
  mapPlaybackEventToScheduledSnapshot,
  type ScheduledTickSnapshot,
} from './ScheduledTickSnapshot';
import type { SongPlaybackCursor } from './SongPlaybackCursor';

export type SongSchedulerAdapterOptions = {
  readonly debugLog?: boolean;
  /** Monotonic anchor in nanoseconds (System.nanoTime domain). Defaults to 0 (relative deadlines). */
  readonly anchorTimeNs?: number;
};

export interface SongSchedulerAdapter {
  readonly anchorTimeNs: number;
  readonly deadlineOffsets: readonly number[];

  setAnchorTimeNs(anchorTimeNs: number): void;
  nextScheduledEvent(): ScheduledTickSnapshot | null;
  peekAhead(count: number): readonly ScheduledTickSnapshot[];
  reset(): void;
  seek(index: number): void;
  snapshotAt(index: number): ScheduledTickSnapshot | null;
}

class SongSchedulerAdapterImpl implements SongSchedulerAdapter {
  private readonly cursor: SongPlaybackCursor;

  private readonly events: readonly PlaybackEvent[];

  private readonly debugLog: boolean;

  readonly deadlineOffsets: readonly number[];

  private _anchorTimeNs: number;

  constructor(
    cursor: SongPlaybackCursor,
    compiled: CompiledPlaybackSequence,
    options: SongSchedulerAdapterOptions = {},
  ) {
    this.cursor = cursor;
    this.events = compiled.events;
    this.debugLog = options.debugLog ?? false;
    this.deadlineOffsets = computeDeadlineOffsets(compiled.events);
    this._anchorTimeNs = options.anchorTimeNs ?? 0;
  }

  get anchorTimeNs(): number {
    return this._anchorTimeNs;
  }

  setAnchorTimeNs(anchorTimeNs: number): void {
    if (!Number.isFinite(anchorTimeNs)) {
      throw new RangeError('anchorTimeNs must be finite');
    }

    this._anchorTimeNs = Math.floor(anchorTimeNs);
  }

  nextScheduledEvent(): ScheduledTickSnapshot | null {
    if (!this.cursor.isPlaying) {
      return null;
    }

    const event = this.cursor.nextEvent();
    if (event === null) {
      return null;
    }

    const snapshot = mapPlaybackEventToScheduledSnapshot(
      event,
      this._anchorTimeNs,
      this.deadlineOffsets,
    );

    this.logSnapshot('nextScheduledEvent', snapshot, this.cursor.currentIndex - 1);
    return snapshot;
  }

  peekAhead(count: number): readonly ScheduledTickSnapshot[] {
    const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const snapshots: ScheduledTickSnapshot[] = [];

    for (let offset = 0; offset < safeCount; offset += 1) {
      const event = this.cursor.peek(offset);
      if (event === null) {
        break;
      }

      snapshots.push(
        mapPlaybackEventToScheduledSnapshot(event, this._anchorTimeNs, this.deadlineOffsets),
      );
    }

    return snapshots;
  }

  reset(): void {
    this.cursor.reset();
  }

  seek(index: number): void {
    this.cursor.seekTo(index);
  }

  snapshotAt(index: number): ScheduledTickSnapshot | null {
    if (!Number.isInteger(index) || index < 0 || index >= this.events.length) {
      return null;
    }

    const event = this.events[index];
    return mapPlaybackEventToScheduledSnapshot(event, this._anchorTimeNs, this.deadlineOffsets);
  }

  private logSnapshot(
    label: string,
    snapshot: ScheduledTickSnapshot,
    eventIndex: number,
  ): void {
    if (!this.debugLog) {
      return;
    }

    console.log(
      `[SongSchedulerAdapter] ${label} index=${eventIndex} seq=${snapshot.sequence} ` +
        `bar=${snapshot.barId} section=${snapshot.sectionId} ` +
        `bpm=${snapshot.bpm} subdiv=${snapshot.subdivisionIndex} ` +
        `deadlineNs=${snapshot.scheduledDeadlineNs}`,
    );
  }
}

export function createSongSchedulerAdapter(
  cursor: SongPlaybackCursor,
  compiled: CompiledPlaybackSequence,
  options?: SongSchedulerAdapterOptions,
): SongSchedulerAdapter {
  return new SongSchedulerAdapterImpl(cursor, compiled, options);
}

/**
 * Collects unpublished snapshots within a lookahead horizon.
 * Mirrors MetronomeEngine.collectLookaheadSnapshotsLocked() without native enqueue.
 */
export function collectLookaheadSnapshots(
  adapter: SongSchedulerAdapter,
  compiled: CompiledPlaybackSequence,
  startIndex: number,
  horizonNs: number,
  nowNs: number,
): ScheduledTickSnapshot[] {
  const snapshots: ScheduledTickSnapshot[] = [];
  let index = Math.max(0, Math.floor(startIndex));

  while (index < compiled.events.length) {
    const snapshot = adapter.snapshotAt(index);
    if (snapshot === null) {
      break;
    }

    if (snapshot.scheduledDeadlineNs > nowNs + horizonNs) {
      break;
    }

    snapshots.push(snapshot);
    index += 1;
  }

  return snapshots;
}

/** Default audio publication horizon (80 ms) — matches MetronomeEngine MIN_LOOKAHEAD_NS. */
export const MIN_SCHEDULER_LOOKAHEAD_NS = 80_000_000;

export function computeSchedulerLookaheadNs(bpm: number, ticksPerBeat = 1): number {
  const tickIntervalNs = beatDurationNs(bpm) / ticksPerBeat;
  const twoTicksNs = tickIntervalNs * 2;
  return Math.max(MIN_SCHEDULER_LOOKAHEAD_NS, twoTicksNs);
}
