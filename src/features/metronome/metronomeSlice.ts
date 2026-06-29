import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_METRONOME, type TimeSignature } from '../../domain/entities/Metronome';
import type { Tick } from '../../domain/timing/Tick';
import { AccentPattern } from '../../domain/valueObjects/AccentPattern';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

export type MetronomeState = {
  bpm: number;
  isPlaying: boolean;
  timeSignature: TimeSignature;
  accentPattern: boolean[];
  subdivision: SubdivisionKind;
  currentBeat: number;
  currentSubdivisionIndex: number;
  isAccent: boolean;
};

const initialState: MetronomeState = {
  bpm: DEFAULT_METRONOME.bpm,
  isPlaying: DEFAULT_METRONOME.isPlaying,
  timeSignature: DEFAULT_METRONOME.timeSignature,
  accentPattern: [...AccentPattern.downbeatOnly(DEFAULT_METRONOME.timeSignature.numerator).toArray()],
  subdivision: 'quarter',
  currentBeat: 0,
  currentSubdivisionIndex: 0,
  isAccent: false,
};

const metronomeSlice = createSlice({
  name: 'metronome',
  initialState,
  reducers: {
    playbackStarted(state) {
      state.isPlaying = true;
    },
    playbackStopped(state) {
      state.isPlaying = false;
      state.currentBeat = 0;
      state.currentSubdivisionIndex = 0;
      state.isAccent = false;
    },
    bpmChanged(state, action: PayloadAction<number>) {
      state.bpm = action.payload;
    },
    timeSignatureChanged(state, action: PayloadAction<TimeSignature>) {
      state.timeSignature = action.payload;
      state.accentPattern = [
        ...AccentPattern.downbeatOnly(action.payload.numerator).toArray(),
      ];
    },
    accentPatternChanged(state, action: PayloadAction<boolean[]>) {
      state.accentPattern = action.payload;
    },
    subdivisionChanged(state, action: PayloadAction<SubdivisionKind>) {
      state.subdivision = action.payload;
    },
    setTick(state, action: PayloadAction<Tick>) {
      state.currentBeat = action.payload.beatIndex % state.timeSignature.numerator;
      state.currentSubdivisionIndex = action.payload.subdivisionIndex;
      state.isAccent = action.payload.isAccent;
    },
  },
});

export const {
  playbackStarted,
  playbackStopped,
  bpmChanged,
  timeSignatureChanged,
  accentPatternChanged,
  subdivisionChanged,
  setTick,
} = metronomeSlice.actions;

export default metronomeSlice.reducer;
