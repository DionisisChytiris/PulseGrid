import type { INativeAudioBridge } from './INativeAudioBridge';

export class NativeAudioBridge implements INativeAudioBridge {
  initialize(): void {
    console.log('NativeAudioBridge.initialize()');
  }

  start(): void {
    console.log('NativeAudioBridge.start()');
  }

  stop(): void {
    console.log('NativeAudioBridge.stop()');
  }

  setTempo(bpm: number): void {
    console.log(`NativeAudioBridge.setTempo(${bpm})`);
  }

  setTimeSignature(numerator: number, denominator: number): void {
    console.log(`NativeAudioBridge.setTimeSignature(${numerator}, ${denominator})`);
  }

  dispose(): void {
    console.log('NativeAudioBridge.dispose()');
  }
}

export const nativeAudioBridge = new NativeAudioBridge();
