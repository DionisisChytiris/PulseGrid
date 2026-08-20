import type { PlaybackEvent } from '../compiler/PlaybackEvent';
import { toEngineBpm } from '../../metronome/PulseGridSettings';

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
  /** Engine BPM (same conversion as Quick Metronome via toEngineBpm). */
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

/**
 * Duration of one compiled click.
 * Musical pulse length is BPM+meter; subdivision only splits that pulse into denser clicks.
 * Uses the same multiply-then-divide split as Quick Metronome so ticks in a pulse
 * sum exactly to the pulse duration (no floor drift).
 */
export function tickDurationNs(event: PlaybackEvent): number {
  const pulseNs = beatDurationNs(toEngineBpm(event.bpm, event.meter.denominator));
  const ticksPerBeat = Math.max(1, event.ticksPerBeat ?? 1);
  const subdiv = Math.min(Math.max(0, event.subdivisionIndex), ticksPerBeat - 1);
  return (
    Math.floor(((subdiv + 1) * pulseNs) / ticksPerBeat) -
    Math.floor((subdiv * pulseNs) / ticksPerBeat)
  );
}

/** Wall-clock duration of one musical bar (primary pulses only) — independent of subdivision. */
export function barDurationNs(events: readonly PlaybackEvent[]): number {
  return computeDeadlineOffsets(events)[events.length] ?? 0;
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
    bpm: toEngineBpm(event.bpm, event.meter.denominator),
    sourceEventIndex: sequence,
  };
}
