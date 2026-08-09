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
  /**
   * When true, song timeline wraps from the last event without stopping.
   * Optional [timelineLoopStartSequence] skips a leading preparation prefix on wrap.
   */
  timelineLoops?: boolean;
  /** Absolute sequence index to begin at within timelineEvents (default 0). */
  timelineStartSequence?: number;
  /**
   * Index of the first event included after a seamless wrap (default 0).
   * Use to keep count-in / preparation outside the loop body.
   */
  timelineLoopStartSequence?: number;
};
