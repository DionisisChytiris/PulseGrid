import type { SongAccentPattern } from './AccentPattern';
import type { ClickPattern } from './ClickPattern';
import { validateClickPattern } from './ClickPattern';
import type { Meter } from './Meter';
import type { TempoDefinition } from './TempoDefinition';
import { cloneTempoDefinition } from './TempoDefinition';
import type { TempoTransitionType } from './TempoEvent';
import type { TempoEvent } from './TempoEvent';

export interface Bar {
  readonly id: string;
  readonly meter: Meter;
  readonly tempoDefinition?: TempoDefinition;
  readonly tempoTransition?: TempoTransitionType;
  readonly accentPattern: SongAccentPattern;
  readonly clickPattern?: ClickPattern;
  readonly repeatCount: number;
}

export type CreateBarInput = {
  id: string;
  meter: Meter;
  accentPattern: SongAccentPattern;
  clickPattern?: ClickPattern;
  tempoDefinition?: TempoDefinition;
  tempoTransition?: TempoTransitionType;
  /** @deprecated Use tempoDefinition on the bar instead. */
  tempo?: TempoEvent;
  repeatCount?: number;
};

export function getBarTempoBpm(bar: Bar): number | undefined {
  return bar.tempoDefinition?.bpm;
}

export function hasBarTempoOverride(bar: Bar): boolean {
  return bar.tempoDefinition !== undefined;
}

export function cloneBarTempoFields(
  bar: Bar,
): Pick<Bar, 'tempoDefinition' | 'tempoTransition'> {
  if (bar.tempoDefinition === undefined) {
    return {};
  }

  return {
    tempoDefinition: cloneTempoDefinition(bar.tempoDefinition),
    ...(bar.tempoTransition === undefined ? {} : { tempoTransition: bar.tempoTransition }),
  };
}

export function createBar(input: CreateBarInput): Bar {
  const repeatCount = input.repeatCount ?? 1;

  if (!Number.isInteger(repeatCount) || repeatCount < 1) {
    throw new RangeError('Bar repeatCount must be a positive integer');
  }

  let tempoDefinition = input.tempoDefinition;
  let tempoTransition = input.tempoTransition;

  if (tempoDefinition === undefined && input.tempo !== undefined) {
    tempoDefinition = input.tempo.tempoDefinition;
    tempoTransition = input.tempo.type;
  }

  if (input.clickPattern !== undefined) {
    validateClickPattern(input.meter, input.clickPattern);
  }

  const base = {
    id: input.id,
    meter: input.meter,
    accentPattern: input.accentPattern,
    repeatCount,
    ...(input.clickPattern === undefined ? {} : { clickPattern: input.clickPattern }),
  };

  if (tempoDefinition === undefined) {
    return base;
  }

  return {
    ...base,
    tempoDefinition,
    ...(tempoTransition === undefined ? {} : { tempoTransition }),
  };
}
