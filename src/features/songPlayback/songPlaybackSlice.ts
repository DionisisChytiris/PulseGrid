import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SongPlaybackModeLabel = 'IDLE' | 'QUICK_METRONOME' | 'SONG_TIMELINE';

export type SongDebugTickState = {
  barId: string;
  sectionId: string;
  bpm: number;
  sequenceIndex: number;
  beatIndexInBar: number;
  beatsPerMeasure: number;
  meterNumerator: number;
  meterDenominator: number;
};

export type SongPlaybackState = {
  playbackMode: SongPlaybackModeLabel;
  isPlaying: boolean;
  isPaused: boolean;
  songName: string | null;
  fallbackReason: string | null;
  currentBarIndex: number;
  totalBars: number;
  debugTick: SongDebugTickState | null;
};

const initialState: SongPlaybackState = {
  playbackMode: 'IDLE',
  isPlaying: false,
  isPaused: false,
  songName: null,
  fallbackReason: null,
  currentBarIndex: 0,
  totalBars: 0,
  debugTick: null,
};

const songPlaybackSlice = createSlice({
  name: 'songPlayback',
  initialState,
  reducers: {
    songTimelinePlaybackStarted(
      state,
      action: PayloadAction<{ songName: string; totalBars: number }>,
    ) {
      state.playbackMode = 'SONG_TIMELINE';
      state.isPlaying = true;
      state.isPaused = false;
      state.songName = action.payload.songName;
      state.totalBars = action.payload.totalBars;
      state.fallbackReason = null;
      state.currentBarIndex = 0;
      state.debugTick = null;
    },
    songTimelinePlaybackPaused(state) {
      state.isPlaying = false;
      state.isPaused = true;
    },
    songTimelinePlaybackResumed(state) {
      state.isPlaying = true;
      state.isPaused = false;
    },
    songTimelinePlaybackStopped(state) {
      state.playbackMode = 'IDLE';
      state.isPlaying = false;
      state.isPaused = false;
      state.songName = null;
      state.currentBarIndex = 0;
      state.totalBars = 0;
      state.debugTick = null;
    },
    quickMetronomeModeActive(state) {
      state.playbackMode = 'QUICK_METRONOME';
      state.fallbackReason = null;
    },
    songTimelineFallbackToQuick(
      state,
      action: PayloadAction<{ reason: string; songName?: string | null }>,
    ) {
      state.playbackMode = 'QUICK_METRONOME';
      state.isPlaying = true;
      state.isPaused = false;
      state.fallbackReason = action.payload.reason;
      state.songName = action.payload.songName ?? state.songName;
      state.debugTick = null;
    },
    songTimelineTickUpdated(
      state,
      action: PayloadAction<SongDebugTickState & { currentBarIndex: number }>,
    ) {
      state.debugTick = {
        barId: action.payload.barId,
        sectionId: action.payload.sectionId,
        bpm: action.payload.bpm,
        sequenceIndex: action.payload.sequenceIndex,
        beatIndexInBar: action.payload.beatIndexInBar,
        beatsPerMeasure: action.payload.beatsPerMeasure,
        meterNumerator: action.payload.meterNumerator,
        meterDenominator: action.payload.meterDenominator,
      };
      state.currentBarIndex = action.payload.currentBarIndex;
    },
  },
});

export const {
  songTimelinePlaybackStarted,
  songTimelinePlaybackPaused,
  songTimelinePlaybackResumed,
  songTimelinePlaybackStopped,
  quickMetronomeModeActive,
  songTimelineFallbackToQuick,
  songTimelineTickUpdated,
} = songPlaybackSlice.actions;

export default songPlaybackSlice.reducer;
