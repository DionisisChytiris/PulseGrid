import NativeAudioModule from './NativeAudioModuleClient';
import type { INativeAudioBridge } from './INativeAudioBridge';

/**
 * JS bridge to the native NativeAudioModule.
 * Forwards lifecycle calls; native engine owns scheduling.
 */
export class NativeAudioBridge implements INativeAudioBridge {
  initialize(): void {
    NativeAudioModule.initialize?.();
  }

  start(): void {
    NativeAudioModule.start({
      bpm: 120,
      beatsPerMeasure: 4,
      accentPattern: [true, false, false, false],
      subdivision: 'quarter',
    });
  }

  stop(): void {
    NativeAudioModule.stop();
  }

  setTempo(bpm: number): void {
    NativeAudioModule.setTempo(bpm);
  }

  setTimeSignature(_numerator: number, _denominator: number): void {
    // Not forwarded to native layer.
  }

  playAccent(): void {
    // Audio runs in native MetronomeEngine.
  }

  playNormal(): void {
    // Audio runs in native MetronomeEngine.
  }

  dispose(): void {
    this.stop();
  }
}

export const nativeAudioBridge = new NativeAudioBridge();
