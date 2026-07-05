import { defaultAudioEngine, defaultTimingSource } from '../../infrastructure/audio/defaultAudioEngine';
import { store } from '../../store';

import { MetronomeTickConsumer } from './MetronomeTickConsumer';
import { PlaybackService } from './PlaybackService';

const tickConsumer = new MetronomeTickConsumer(store.dispatch, () => store.getState());

/** App-wide singleton — prevents duplicate tick listener registration on remount. */
export const playbackService = new PlaybackService(
  store.dispatch,
  () => store.getState(),
  defaultAudioEngine,
  defaultTimingSource,
  tickConsumer,
);
