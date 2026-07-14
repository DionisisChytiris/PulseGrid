export const MS_PER_MINUTE = 60_000;

export interface TempoState {
  readonly bpm: number;
}

export function createTempoState(bpm: number): TempoState {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive number');
  }

  return { bpm };
}
