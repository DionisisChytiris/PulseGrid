import { combineReducers, configureStore } from '@reduxjs/toolkit';

import metronomeReducer from '../features/metronome/metronomeSlice';

const rootReducer = combineReducers({
  metronome: metronomeReducer,
});

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
