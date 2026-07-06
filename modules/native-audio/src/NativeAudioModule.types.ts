export type NativeSubdivisionKind = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

export type NativeTimelinePlaybackEvent = {
  sequence: number;
  bpm: number;
  accent: boolean;
  subdivisionIndex: number;
  beatIndexInBar: number;
  beatsPerMeasure: number;
  barId: string;
  sectionId: string;
};

export type NativePlaybackMode = 'quick_metronome' | 'song_timeline';

export type NativeAudioStartOptions = {
  bpm: number;
  beatsPerMeasure: number;
  accentPattern: boolean[];
  subdivision: NativeSubdivisionKind;
  playbackMode?: NativePlaybackMode;
  timelineEvents?: NativeTimelinePlaybackEvent[];
};
