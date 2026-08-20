import type { SongAccentPattern } from '../../domain/music/AccentPattern';
import type { Meter } from '../../domain/music/Meter';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

/** UI-only view model: consecutive bars sharing the same meter. */
export type TimelineSegment = {
  readonly id: string;
  readonly startBarIndex: number;
  readonly endBarIndex: number;
  readonly numberOfBars: number;
  readonly meter: Meter;
  readonly meterLabel: string;
  readonly barIds: readonly string[];
  /** Optional metadata — first uniform BPM in segment, or null. */
  readonly bpmOverride: number | null;
  /** Uniform bar subdivision, or Quarter when mixed/absent. */
  readonly subdivision: SubdivisionKind;
  readonly accentPattern: SongAccentPattern;
  readonly sectionId: string;
  readonly sectionName: string;
};
