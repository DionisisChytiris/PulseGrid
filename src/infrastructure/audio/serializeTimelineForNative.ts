import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../../domain/music/compiler/PlaybackEvent';

/** Wire format for one compiled tick passed to native MetronomeEngine. */
export type NativeTimelinePlaybackEvent = {
  readonly sequence: number;
  readonly bpm: number;
  readonly accent: boolean;
  readonly subdivisionIndex: number;
  readonly beatIndexInBar: number;
  readonly beatsPerMeasure: number;
  readonly barId: string;
  readonly sectionId: string;
};

export function serializeTimelineEventForNative(event: PlaybackEvent): NativeTimelinePlaybackEvent {
  return {
    sequence: event.sequence,
    bpm: event.bpm,
    accent: event.accent,
    subdivisionIndex: event.subdivisionIndex,
    beatIndexInBar: event.beatIndexInBar,
    beatsPerMeasure: event.meter.numerator,
    barId: event.barId,
    sectionId: event.sectionId,
  };
}

export function serializeCompiledSequenceForNative(
  compiled: CompiledPlaybackSequence,
): NativeTimelinePlaybackEvent[] {
  return compiled.events.map(serializeTimelineEventForNative);
}
