import { useEffect, useState } from 'react';

import NativeAudioModule from '../../infrastructure/audio/NativeAudioModuleClient';

/**
 * Beat flash for Quick Metronome dial LEDs — driven by native onTick,
 * not Redux. Returns zero-based beat index, or -1 when idle / not flashing.
 */
export function useBeatFlashPulse(isPlaying: boolean, beatCount: number): number {
  const [flashBeatIndex, setFlashBeatIndex] = useState(-1);

  useEffect(() => {
    if (!isPlaying || beatCount <= 0) {
      setFlashBeatIndex(-1);
      return;
    }

    const subscription = NativeAudioModule.addListener?.('onTick', (event) => {
      const beatNumber = event.beatNumber ?? 0;
      if (beatNumber <= 0) {
        return;
      }

      const nextIndex = (beatNumber - 1) % beatCount;
      setFlashBeatIndex((previous) => (previous === nextIndex ? previous : nextIndex));
    });

    return () => {
      subscription?.remove();
      setFlashBeatIndex(-1);
    };
  }, [isPlaying, beatCount]);

  return isPlaying ? flashBeatIndex : -1;
}
