import { toNativeSubdivision, type SubdivisionKind } from '../../domain/valueObjects/Subdivision';

import type { IAudioEngine, MetronomeStartConfig } from './IAudioEngine';
import NativeAudioModule from './NativeAudioModuleClient';

/**
 * Native metronome lifecycle — start/stop/tempo/accent pattern.
 * Click playback runs on the native timing thread inside MetronomeEngine.
 */
export class NativeAudioEngine implements IAudioEngine {
  private isRunning = false;

  initialize(): void {
    NativeAudioModule.initialize?.();
  }

  whenReady(): Promise<void> {
    return NativeAudioModule.whenReady?.() ?? Promise.resolve();
  }

  start(config: MetronomeStartConfig): void {
    if (this.isRunning) {
      this.hardStop();
    }

    this.isRunning = true;
    NativeAudioModule.start({
      bpm: config.bpm,
      beatsPerMeasure: config.beatsPerMeasure,
      accentPattern: [...config.accentPattern],
      subdivision: toNativeSubdivision(config.subdivision),
    });
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.hardStop();
  }

  private hardStop(): void {
    this.isRunning = false;
    NativeAudioModule.stop();
  }

  setTempo(bpm: number): void {
    NativeAudioModule.setTempo(bpm);
  }

  setAccentPattern(accentPattern: boolean[]): void {
    NativeAudioModule.setAccentPattern([...accentPattern]);
  }

  setSubdivision(subdivision: SubdivisionKind): void {
    const nativeSubdivision = toNativeSubdivision(subdivision);
    NativeAudioModule.setSubdivision(nativeSubdivision);
  }
}

export const nativeAudioEngine = new NativeAudioEngine();
