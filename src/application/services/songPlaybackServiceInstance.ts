import { store } from '../../store';

import { SongPlaybackService } from './SongPlaybackService';
import { playbackService } from './playbackServiceInstance';

export const songPlaybackService = new SongPlaybackService(
  store.dispatch,
  playbackService,
);
