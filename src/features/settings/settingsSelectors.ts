import type { RootState } from '../../store';

export const selectNormalClickSound = (state: RootState) => state.settings.normalClickSound;

export const selectAccentClickSound = (state: RootState) => state.settings.accentClickSound;

export const selectSubdivisionClickSound = (state: RootState) =>
  state.settings.subdivisionClickSound;

export const selectSubdivisionAccentMode = (state: RootState) =>
  state.settings.subdivisionAccentMode;

export const selectSubdivisionAccentEveryNth = (state: RootState) =>
  state.settings.subdivisionAccentEveryNth;

export const selectSubdivisionAccentPattern = (state: RootState) =>
  state.settings.subdivisionAccentPattern;

export const selectSettingsHydrated = (state: RootState) => state.settings.hydrated;

export const selectMetronomeSoundSettings = (state: RootState) => ({
  normalClickSound: state.settings.normalClickSound,
  accentClickSound: state.settings.accentClickSound,
  subdivisionClickSound: state.settings.subdivisionClickSound,
});
