import { Platform } from 'react-native';

import type { IAudioEngine } from './IAudioEngine';
import type { ITimingSource } from './ITimingSource';
import { isNativeAudioModuleAvailable } from './NativeAudioModuleClient';
import { nativeAudioEngine } from './NativeAudioEngine';
import { nativeTimingSource } from './NativeTimingSource';
import { noopAudioEngine } from './NoopAudioEngine';
import { visualTickScheduler } from './VisualTickScheduler';

function selectAudioEngine(): IAudioEngine {
  if (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    isNativeAudioModuleAvailable()
  ) {
    return nativeAudioEngine;
  }

  
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    console.warn(
      'NativeAudioModule not linked — audio disabled until dev client is rebuilt.',
    );
  }

  return noopAudioEngine;
}

function selectTimingSource(): ITimingSource {
  if (
    (Platform.OS === 'ios' || Platform.OS === 'android') &&
    isNativeAudioModuleAvailable()
  ) {
    return nativeTimingSource;
  }

  return visualTickScheduler;
}

/** Native metronome lifecycle when linked; otherwise silent. */
export const defaultAudioEngine: IAudioEngine = selectAudioEngine();

/** Pure timing ticks — native onTick when linked, JS scheduler on web. */
export const defaultTimingSource: ITimingSource = selectTimingSource();

export const usesNativeTiming = isNativeAudioModuleAvailable();
