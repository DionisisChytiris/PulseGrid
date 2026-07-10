import type { SongAccentPattern } from '../AccentPattern';
import type { SubdivisionKind } from '../../valueObjects/Subdivision';

/**
 * One primary beat in a compiled song timeline.
 * Pure musical intent — [beatDurationNs] is the precomputed pulse duration for this tick.
 */
export interface TimelinePlaybackEvent {
  readonly sequenceIndex: number;
  readonly scheduledBpm: number;
  readonly beatDurationNs: number;
  readonly beatsPerBar: number;
  readonly subdivision: SubdivisionKind;
  readonly accentPattern: SongAccentPattern;
  /** Debug metadata — bar instance identity in the source score. */
  readonly barId: string;
  /** Debug metadata — parent section identity in the source score. */
  readonly sectionId: string;
}
