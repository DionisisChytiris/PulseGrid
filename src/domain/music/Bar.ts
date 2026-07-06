import type { SongAccentPattern } from './AccentPattern';
import type { Meter } from './Meter';
import type { TempoEvent } from './TempoEvent';

export interface Bar {
  readonly id: string;
  readonly meter: Meter;
  readonly tempo?: TempoEvent;
  readonly accentPattern: SongAccentPattern;
  readonly repeatCount: number;
}

export type CreateBarInput = {
  id: string;
  meter: Meter;
  accentPattern: SongAccentPattern;
  tempo?: TempoEvent;
  repeatCount?: number;
};

export function createBar(input: CreateBarInput): Bar {
  const repeatCount = input.repeatCount ?? 1;

  if (!Number.isInteger(repeatCount) || repeatCount < 1) {
    throw new RangeError('Bar repeatCount must be a positive integer');
  }

  if (input.tempo === undefined) {
    return {
      id: input.id,
      meter: input.meter,
      accentPattern: input.accentPattern,
      repeatCount,
    };
  }

  return {
    id: input.id,
    meter: input.meter,
    tempo: input.tempo,
    accentPattern: input.accentPattern,
    repeatCount,
  };
}
