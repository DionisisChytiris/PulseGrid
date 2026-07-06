import { combineReducers, configureStore } from '@reduxjs/toolkit';

import metronomeReducer from '../features/metronome/metronomeSlice';
import songPlaybackReducer from '../features/songPlayback/songPlaybackSlice';

const rootReducer = combineReducers({
  metronome: metronomeReducer,
  songPlayback: songPlaybackReducer,
});

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
