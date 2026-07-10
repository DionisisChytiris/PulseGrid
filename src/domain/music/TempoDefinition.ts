import { BeatUnit } from './BeatUnit';
import { inferTempoBeatUnitFromMeter, type Meter } from './Meter';

/** BPM plus the notated beat unit it refers to. */
export interface TempoDefinition {
  readonly bpm: number;
  readonly beatUnit: BeatUnit;
}

export function createTempoDefinition(bpm: number, beatUnit: BeatUnit): TempoDefinition {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('TempoDefinition bpm must be a positive number');
  }

  return { bpm, beatUnit };
}

/** Create a tempo definition from BPM and meter (infers beat unit). */
export function createTempoDefinitionForMeter(bpm: number, meter: Meter): TempoDefinition {
  return createTempoDefinition(bpm, inferTempoBeatUnitFromMeter(meter));
}

export function cloneTempoDefinition(definition: TempoDefinition): TempoDefinition {
  return createTempoDefinition(definition.bpm, definition.beatUnit);
}

export function getTempoDefinitionBpm(definition: TempoDefinition): number {
  return definition.bpm;
}
