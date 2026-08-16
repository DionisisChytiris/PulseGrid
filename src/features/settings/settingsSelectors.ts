import { createSelector } from '@reduxjs/toolkit';

import type { RootState } from '../../store';

export const selectNormalClickSound = (state: RootState) => state.settings.normalClickSound;

export const selectAccentClickSound = (state: RootState) => state.settings.accentClickSound;

export const selectBarClickSound = (state: RootState) => state.settings.barClickSound;

export const selectBarStartEnabled = (state: RootState) => state.settings.barStartEnabled;

export const selectSubdivisionClickSound = (state: RootState) =>
  state.settings.subdivisionClickSound;

export const selectSubdivisionAccentMode = (state: RootState) =>
  state.settings.subdivisionAccentMode;

export const selectSubdivisionAccentEveryNth = (state: RootState) =>
  state.settings.subdivisionAccentEveryNth;

export const selectSubdivisionAccentPattern = (state: RootState) =>
  state.settings.subdivisionAccentPattern;

export const selectSettingsHydrated = (state: RootState) => state.settings.hydrated;

export const selectClickVolumes = createSelector(
  (state: RootState) => state.settings.barBeatVolume,
  (state: RootState) => state.settings.accentBeatVolume,
  (state: RootState) => state.settings.normalBeatVolume,
  (bar, accent, normal) => ({ bar, accent, normal }),
);

export const selectMetronomeSoundSettings = (state: RootState) => ({
  normalClickSound: state.settings.normalClickSound,
  accentClickSound: state.settings.accentClickSound,
  barClickSound: state.settings.barClickSound,
  subdivisionClickSound: state.settings.subdivisionClickSound,
});
