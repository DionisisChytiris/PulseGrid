import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import {
  DEFAULT_ACCENT_CLICK_SOUND,
  DEFAULT_BAR_CLICK_SOUND,
  DEFAULT_NORMAL_CLICK_SOUND,
  DEFAULT_SUBDIVISION_CLICK_SOUND,
  type AccentClickSoundId,
  type BarClickSoundId,
  type NormalClickSoundId,
  type SubdivisionClickSoundId,
} from '../../domain/metronome/ClickSoundCatalog';
import {
  DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH,
  DEFAULT_SUBDIVISION_ACCENT_MODE,
  type SubdivisionAccentMode,
} from '../../domain/metronome/SubdivisionAccentMode';
import {
  DEFAULT_SUBDIVISION_ACCENT_PATTERN,
  type SubdivisionAccentPattern,
} from '../../domain/metronome/SubdivisionAccentPattern';

export type SettingsState = {
  normalClickSound: NormalClickSoundId;
  accentClickSound: AccentClickSoundId;
  barClickSound: BarClickSoundId;
  subdivisionClickSound: SubdivisionClickSoundId;
  barStartEnabled: boolean;
  subdivisionAccentMode: SubdivisionAccentMode;
  subdivisionAccentEveryNth: number;
  subdivisionAccentPattern: SubdivisionAccentPattern;
  hydrated: boolean;
};

const initialState: SettingsState = {
  normalClickSound: DEFAULT_NORMAL_CLICK_SOUND,
  accentClickSound: DEFAULT_ACCENT_CLICK_SOUND,
  barClickSound: DEFAULT_BAR_CLICK_SOUND,
  subdivisionClickSound: DEFAULT_SUBDIVISION_CLICK_SOUND,
  barStartEnabled: true,
  subdivisionAccentMode: DEFAULT_SUBDIVISION_ACCENT_MODE,
  subdivisionAccentEveryNth: DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH,
  subdivisionAccentPattern: DEFAULT_SUBDIVISION_ACCENT_PATTERN,
  hydrated: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    settingsHydrated(
      state,
      action: PayloadAction<{
        normalClickSound: NormalClickSoundId;
        accentClickSound: AccentClickSoundId;
        barClickSound: BarClickSoundId;
        subdivisionClickSound: SubdivisionClickSoundId;
        barStartEnabled: boolean;
        subdivisionAccentMode: SubdivisionAccentMode;
        subdivisionAccentEveryNth: number;
        subdivisionAccentPattern: SubdivisionAccentPattern;
      }>,
    ) {
      state.normalClickSound = action.payload.normalClickSound;
      state.accentClickSound = action.payload.accentClickSound;
      state.barClickSound = action.payload.barClickSound;
      state.subdivisionClickSound = action.payload.subdivisionClickSound;
      state.barStartEnabled = action.payload.barStartEnabled;
      state.subdivisionAccentMode = action.payload.subdivisionAccentMode;
      state.subdivisionAccentEveryNth = action.payload.subdivisionAccentEveryNth;
      state.subdivisionAccentPattern = action.payload.subdivisionAccentPattern;
      state.hydrated = true;
    },
    normalClickSoundChanged(state, action: PayloadAction<NormalClickSoundId>) {
      state.normalClickSound = action.payload;
    },
    accentClickSoundChanged(state, action: PayloadAction<AccentClickSoundId>) {
      state.accentClickSound = action.payload;
    },
    barClickSoundChanged(state, action: PayloadAction<BarClickSoundId>) {
      state.barClickSound = action.payload;
    },
    subdivisionClickSoundChanged(state, action: PayloadAction<SubdivisionClickSoundId>) {
      state.subdivisionClickSound = action.payload;
    },
    barStartEnabledChanged(state, action: PayloadAction<boolean>) {
      state.barStartEnabled = action.payload;
    },
    subdivisionAccentModeChanged(state, action: PayloadAction<SubdivisionAccentMode>) {
      state.subdivisionAccentMode = action.payload;
    },
    subdivisionAccentEveryNthChanged(state, action: PayloadAction<number>) {
      state.subdivisionAccentEveryNth = action.payload;
    },
    subdivisionAccentPatternChanged(state, action: PayloadAction<SubdivisionAccentPattern>) {
      state.subdivisionAccentPattern = [...action.payload];
    },
  },
});

export const {
  settingsHydrated,
  normalClickSoundChanged,
  accentClickSoundChanged,
  barClickSoundChanged,
  subdivisionClickSoundChanged,
  barStartEnabledChanged,
  subdivisionAccentModeChanged,
  subdivisionAccentEveryNthChanged,
  subdivisionAccentPatternChanged,
} = settingsSlice.actions;

export default settingsSlice.reducer;
