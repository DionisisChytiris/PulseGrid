import { NativeModule, registerWebModule } from 'expo';

import type { NativeAudioStartOptions } from './NativeAudioModule';

class NativeAudioModule extends NativeModule<Record<string, never>> {
  initialize(): void {
    console.log('NativeAudioModule.initialize() called');
  }

  start(_options: NativeAudioStartOptions): void {
    console.log('NativeAudioModule.start() called');
  }

  stop(): void {
    console.log('NativeAudioModule.stop() called');
  }

  setTempo(_bpm: number): void {
    console.log('NativeAudioModule.setTempo() called');
  }

  setAccentPattern(_accentPattern: boolean[]): void {
    console.log('NativeAudioModule.setAccentPattern() called');
  }

  setSubdivision(_subdivision: string): void {
    console.log('NativeAudioModule.setSubdivision() called');
  }
}

export default registerWebModule(NativeAudioModule, 'NativeAudioModule');
