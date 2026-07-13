import { store } from '../../store';
import { defaultAudioEngine } from '../../infrastructure/audio/defaultAudioEngine';

import { ClickSoundService } from './ClickSoundService';

export const clickSoundService = new ClickSoundService(
  store.dispatch,
  store.getState,
  defaultAudioEngine,
);
