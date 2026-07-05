export type NativeSubdivisionKind = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

export type NativeAudioStartOptions = {
  bpm: number;
  beatsPerMeasure: number;
  accentPattern: boolean[];
  subdivision: NativeSubdivisionKind;
};
