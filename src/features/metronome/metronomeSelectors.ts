import type { RootState } from '../../store';

export const selectMetronome = (state: RootState) => state.metronome;

export const selectBpm = (state: RootState) => state.metronome.bpm;

export const selectIsPlaying = (state: RootState) => state.metronome.isPlaying;

export const selectTimeSignature = (state: RootState) => state.metronome.timeSignature;

export const selectAccentPattern = (state: RootState) => state.metronome.accentPattern;

export const selectSubdivision = (state: RootState) => state.metronome.subdivision;

export const selectCurrentBeat = (state: RootState) => state.metronome.currentBeat;

export const selectCurrentSubdivisionIndex = (state: RootState) =>
  state.metronome.currentSubdivisionIndex;

export const selectIsAccent = (state: RootState) => state.metronome.isAccent;
