import type { IAudioEngine } from './IAudioEngine';
import { ExpoAudioEngine, expoAudioEngine } from './ExpoAudioEngine';
import type { INativeAudioBridge } from './INativeAudioBridge';

export class NativeAudioBridge implements INativeAudioBridge {
  constructor(private readonly audioEngine: IAudioEngine = expoAudioEngine) {}

  initialize(): void {
    this.audioEngine.initialize();
  }

  start(): void {
    this.audioEngine.start();
  }

  stop(): void {
    this.audioEngine.stop();
  }

  setTempo(bpm: number): void {
    this.audioEngine.setTempo(bpm);
  }

  setTimeSignature(numerator: number, denominator: number): void {
    console.log(`NativeAudioBridge.setTimeSignature(${numerator}, ${denominator})`);
  }

  dispose(): void {
    if (this.audioEngine instanceof ExpoAudioEngine) {
      void this.audioEngine.dispose();
    }
  }
}

export const nativeAudioBridge = new NativeAudioBridge();
