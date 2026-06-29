export interface TimeSignature {
  numerator: number;
  denominator: number;
}

export interface Metronome {
  bpm: number;
  isPlaying: boolean;
  timeSignature: TimeSignature;
}

export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4,
};

export const DEFAULT_METRONOME: Metronome = {
  bpm: 120,
  isPlaying: false,
  timeSignature: DEFAULT_TIME_SIGNATURE,
};
