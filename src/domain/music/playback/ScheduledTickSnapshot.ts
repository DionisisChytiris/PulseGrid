import type { PlaybackEvent } from '../compiler/PlaybackEvent';

/**
 * Scheduler-facing tick snapshot aligned with MetronomeEngine TickSnapshot.
 * Used by SongSchedulerAdapter before native enqueueAudioForTick().
 */
export type ScheduledTickSnapshot = {
  readonly sequence: number;
  readonly beatIndexInBar: number;
  readonly beatNumber: number;
  readonly beatsPerMeasure: number;
  readonly subdivisionIndex: number;
  readonly isAccent: boolean;
  /** Relative offset in ms; 0 for lookahead previews. */
  readonly timestampMs: number;
  readonly scheduledDeadlineNs: number;
  readonly barId: string;
  readonly sectionId: string;
  readonly bpm: number;
  readonly sourceEventIndex: number;
};

/** Nanosecond duration of one beat at [bpm] — matches native beatDurationNs(). */
export function beatDurationNs(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive finite number');
  }

  return Math.max(1, Math.floor(60_000_000_000 / bpm));
}

/** Cumulative score offsets per sequence index — matches native SongTimelineEventSource. */
export function computeDeadlineOffsets(events: readonly PlaybackEvent[]): readonly number[] {
  const offsets = new Array<number>(events.length + 1);
  let offsetNs = 0;

  for (let index = 0; index < events.length; index += 1) {
    offsets[index] = offsetNs;
    offsetNs += tickDurationNs(events[index]);
  }

  offsets[events.length] = offsetNs;
  return offsets;
}

function tickDurationNs(event: PlaybackEvent): number {
  return beatDurationNs(event.bpm);
}

export function mapPlaybackEventToScheduledSnapshot(
  event: PlaybackEvent,
  anchorTimeNs: number,
  deadlineOffsets: readonly number[],
): ScheduledTickSnapshot {
  const sequence = event.sequence;
  const offsetNs = deadlineOffsets[sequence] ?? 0;

  return {
    sequence,
    beatIndexInBar: event.beatIndexInBar,
    beatNumber: event.beatIndexInBar + 1,
    beatsPerMeasure: event.meter.numerator,
    subdivisionIndex: event.subdivisionIndex,
    isAccent: event.accent,
    timestampMs: 0,
    scheduledDeadlineNs: anchorTimeNs + offsetNs,
    barId: event.barId,
    sectionId: event.sectionId,
    bpm: event.bpm,
    sourceEventIndex: sequence,
  };
}
