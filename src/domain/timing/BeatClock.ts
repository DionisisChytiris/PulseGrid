import { MS_PER_MINUTE, type TempoState } from './TempoMap';

export function msPerBeat(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive number');
  }

  return MS_PER_MINUTE / bpm;
}

/**
 * Converts between musical beats and logical milliseconds at a given tempo.
 */
export class BeatClock {
  private tempo: TempoState;

  constructor(tempo: TempoState) {
    this.tempo = tempo;
  }

  getBpm(): number {
    return this.tempo.bpm;
  }

  getTempo(): TempoState {
    return this.tempo;
  }

  setTempo(tempo: TempoState): void {
    this.tempo = tempo;
  }

  beatsToMs(beats: number): number {
    return beats * msPerBeat(this.tempo.bpm);
  }

  msToBeats(ms: number): number {
    return ms / msPerBeat(this.tempo.bpm);
  }
}
