import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { DEFAULT_METRONOME, type TimeSignature } from '../../domain/entities/Metronome';
import {
  defaultAccentPatternForTimeSignature,
  normalizeFinerSubdivision,
  resolveEngineSubdivision,
  toDisplayBpm,
  toEngineBpm,
  type FinerSubdivisionSelection,
} from '../../domain/metronome/PulseGridSettings';
import type { Tick } from '../../domain/timing/Tick';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

export type MetronomeState = {
  /** Engine-facing BPM consumed by PlaybackService without modification. */
  bpm: number;
  isPlaying: boolean;
  timeSignature: TimeSignature;
  accentPattern: boolean[];
  /** Native-engine subdivision derived from finerSubdivision + denominator. */
  subdivision: SubdivisionKind;
  /** Optional subdivision finer than the denominator pulse grid. */
  finerSubdivision: FinerSubdivisionSelection;
  currentBeat: number;
  currentSubdivisionIndex: number;
  isAccent: boolean;
};

function syncEngineSubdivision(state: MetronomeState): void {
  state.finerSubdivision = normalizeFinerSubdivision(
    state.timeSignature.denominator,
    state.finerSubdivision,
  );
  state.subdivision = resolveEngineSubdivision(
    state.timeSignature.denominator,
    state.finerSubdivision,
  );
}

const initialTimeSignature = DEFAULT_METRONOME.timeSignature;

const initialState: MetronomeState = {
  bpm: toEngineBpm(DEFAULT_METRONOME.bpm, initialTimeSignature.denominator),
  isPlaying: DEFAULT_METRONOME.isPlaying,
  timeSignature: initialTimeSignature,
  accentPattern: defaultAccentPatternForTimeSignature(initialTimeSignature),
  subdivision: 'quarter',
  finerSubdivision: null,
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
      const displayBpm = toDisplayBpm(state.bpm, state.timeSignature.denominator);
      state.timeSignature = action.payload;
      state.accentPattern = defaultAccentPatternForTimeSignature(action.payload);
      state.finerSubdivision = null;
      state.bpm = toEngineBpm(displayBpm, action.payload.denominator);
      syncEngineSubdivision(state);
    },
    accentPatternChanged(state, action: PayloadAction<boolean[]>) {
      state.accentPattern = action.payload;
    },
    finerSubdivisionChanged(state, action: PayloadAction<FinerSubdivisionSelection>) {
      state.finerSubdivision = action.payload;
      syncEngineSubdivision(state);
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
  finerSubdivisionChanged,
  subdivisionChanged,
  setTick,
} = metronomeSlice.actions;

export default metronomeSlice.reducer;
