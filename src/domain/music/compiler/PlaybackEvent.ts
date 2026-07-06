import type { Meter } from '../Meter';

export type PlaybackEventSource = 'song' | 'tempoEvent';

/**
 * One primary beat tick in compiled score order.
 * No timestamps — scheduling is applied by a future playback layer.
 */
export interface PlaybackEvent {
  readonly sequence: number;
  readonly barId: string;
  readonly sectionId: string;
  readonly meter: Meter;
  readonly bpm: number;
  readonly accent: boolean;
  /** Subdivision pulse within the beat (0 = primary beat). */
  readonly subdivisionIndex: number;
  readonly globalTickIndex: number;
  readonly source: PlaybackEventSource;
  readonly repeatIndex: number;
  /** Zero-based beat index within the bar (0 .. meter.numerator - 1). */
  readonly beatIndexInBar: number;
  /** Zero-based index of this bar instance in the compiled score. */
  readonly globalBarIndex: number;
}
