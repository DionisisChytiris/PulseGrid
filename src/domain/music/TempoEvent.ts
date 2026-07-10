import type { Meter } from './Meter';
import {
  createTempoDefinition,
  createTempoDefinitionForMeter,
  cloneTempoDefinition,
  type TempoDefinition,
} from './TempoDefinition';
import { BeatUnit } from './BeatUnit';

/** How tempo changes at a bar boundary. Playback interprets curves later. */
export type TempoTransitionType = 'instant' | 'linear';

/**
 * Optional per-bar tempo override with transition metadata.
 * Prefer Bar.tempoDefinition + Bar.tempoTransition for new code.
 */
export interface TempoEvent {
  readonly tempoDefinition: TempoDefinition;
  readonly type: TempoTransitionType;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export function getTempoEventBpm(event: TempoEvent): number {
  return event.tempoDefinition.bpm;
}

export function createTempoEvent(
  bpm: number,
  type: TempoTransitionType = 'instant',
  metadata?: Readonly<Record<string, string | number | boolean>>,
  meter?: Meter,
): TempoEvent {
  const tempoDefinition =
    meter === undefined
      ? createTempoDefinition(bpm, BeatUnit.QUARTER)
      : createTempoDefinitionForMeter(bpm, meter);

  return metadata === undefined
    ? { tempoDefinition, type }
    : { tempoDefinition, type, metadata };
}

export function cloneTempoEvent(event: TempoEvent): TempoEvent {
  const tempoDefinition = cloneTempoDefinition(event.tempoDefinition);

  return event.metadata === undefined
    ? { tempoDefinition, type: event.type }
    : { tempoDefinition, type: event.type, metadata: { ...event.metadata } };
}
