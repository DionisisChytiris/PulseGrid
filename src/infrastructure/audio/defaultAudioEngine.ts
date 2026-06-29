import type { IAudioEngine } from './IAudioEngine';
import { expoAudioEngine } from './ExpoAudioEngine';

/** Default app audio backend — swap implementation without changing PlaybackService. */
export const defaultAudioEngine: IAudioEngine = expoAudioEngine;
