import { combineReducers, configureStore } from '@reduxjs/toolkit';

import metronomeReducer from '../features/metronome/metronomeSlice';
import settingsReducer from '../features/settings/settingsSlice';
import songPlaybackReducer from '../features/songPlayback/songPlaybackSlice';

const rootReducer = combineReducers({
  metronome: metronomeReducer,
  settings: settingsReducer,
  songPlayback: songPlaybackReducer,
});

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
