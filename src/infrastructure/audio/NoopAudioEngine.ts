import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import type { IAudioEngine, MetronomeStartConfig } from './IAudioEngine';

/** Placeholder when native audio is unavailable — does not schedule or play audio. */
export class NoopAudioEngine implements IAudioEngine {
  initialize(): void {
    console.warn('NoopAudioEngine: native module unavailable — no audio playback');
  }

  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  start(config: MetronomeStartConfig): void {
    console.warn(
      'NoopAudioEngine: start(bpm=%s) ignored — rebuild dev client with NativeAudioModule',
      config.bpm,
    );
  }

  stop(): void {}

  setTempo(_bpm: number): void {}

  setAccentPattern(_accentPattern: boolean[]): void {}

  setSubdivision(_subdivision: SubdivisionKind): void {}
}

export const noopAudioEngine = new NoopAudioEngine();
