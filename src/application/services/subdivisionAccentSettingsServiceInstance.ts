import { store } from '../../store';
import { defaultAudioEngine } from '../../infrastructure/audio/defaultAudioEngine';

import { SubdivisionAccentSettingsService } from './SubdivisionAccentSettingsService';

export const subdivisionAccentSettingsService = new SubdivisionAccentSettingsService(
  store.dispatch,
  store.getState,
  defaultAudioEngine,
);
