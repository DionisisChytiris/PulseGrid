import type { RootState } from '../../store';
import {
  getSubdivisionAvailability,
  toDisplayBpm,
} from '../../domain/metronome/PulseGridSettings';

export const selectMetronome = (state: RootState) => state.metronome;

/** Display BPM shown in the UI (denominator-aware musical tempo). */
export const selectBpm = (state: RootState) =>
  toDisplayBpm(state.metronome.bpm, state.metronome.timeSignature.denominator);

export const selectEngineBpm = (state: RootState) => state.metronome.bpm;

export const selectIsPlaying = (state: RootState) => state.metronome.isPlaying;

export const selectTimeSignature = (state: RootState) => state.metronome.timeSignature;

export const selectAccentPattern = (state: RootState) => state.metronome.accentPattern;

export const selectSubdivision = (state: RootState) => state.metronome.subdivision;

export const selectFinerSubdivision = (state: RootState) => state.metronome.finerSubdivision;

export const selectSubdivisionAvailability = (state: RootState) =>
  getSubdivisionAvailability(state.metronome.timeSignature.denominator);

export const selectCurrentBeat = (state: RootState) => state.metronome.currentBeat;

export const selectCurrentSubdivisionIndex = (state: RootState) =>
  state.metronome.currentSubdivisionIndex;

export const selectIsAccent = (state: RootState) => state.metronome.isAccent;
