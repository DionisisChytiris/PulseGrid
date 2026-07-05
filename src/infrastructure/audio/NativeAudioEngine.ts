import { toNativeSubdivision, type SubdivisionKind } from '../../domain/valueObjects/Subdivision';

import type { IAudioEngine, MetronomeStartConfig } from './IAudioEngine';
import { audioDebugLog } from './audioDebugLog';
import NativeAudioModule from './NativeAudioModuleClient';

/**
 * Native metronome lifecycle — start/stop/tempo/accent pattern.
 * Click playback runs on the native timing thread inside MetronomeEngine.
 */
export class NativeAudioEngine implements IAudioEngine {
  private isRunning = false;

  initialize(): void {
    audioDebugLog('NativeAudioEngine', 'initialize', '-> native module');
    NativeAudioModule.initialize?.();
  }

  whenReady(): Promise<void> {
    audioDebugLog('NativeAudioEngine', 'whenReady', '-> native module');
    return NativeAudioModule.whenReady?.() ?? Promise.resolve();
  }

  start(config: MetronomeStartConfig): void {
    if (this.isRunning) {
      audioDebugLog('NativeAudioEngine', 'start', 'duplicate blocked — hard stop then restart');
      this.hardStop();
    }

    this.isRunning = true;
    audioDebugLog('NativeAudioEngine', 'start', `loop starting bpm=${config.bpm}`);
    NativeAudioModule.start({
      bpm: config.bpm,
      beatsPerMeasure: config.beatsPerMeasure,
      accentPattern: [...config.accentPattern],
      subdivision: toNativeSubdivision(config.subdivision),
    });
  }

  stop(): void {
    if (!this.isRunning) {
      audioDebugLog('NativeAudioEngine', 'stop', 'not running — ignored');
      return;
    }

    this.hardStop();
  }

  private hardStop(): void {
    audioDebugLog('NativeAudioEngine', 'stop', 'loop stopping');
    this.isRunning = false;
    NativeAudioModule.stop();
  }

  setTempo(bpm: number): void {
    audioDebugLog('NativeAudioEngine', 'setTempo', `bpm=${bpm} -> native module`);
    NativeAudioModule.setTempo(bpm);
  }

  setAccentPattern(accentPattern: boolean[]): void {
    audioDebugLog(
      'NativeAudioEngine',
      'setAccentPattern',
      `length=${accentPattern.length} -> native module`,
    );
    NativeAudioModule.setAccentPattern([...accentPattern]);
  }

  setSubdivision(subdivision: SubdivisionKind): void {
    const nativeSubdivision = toNativeSubdivision(subdivision);
    audioDebugLog('NativeAudioEngine', 'setSubdivision', `${nativeSubdivision} -> native module`);
    NativeAudioModule.setSubdivision(nativeSubdivision);
  }
}

export const nativeAudioEngine = new NativeAudioEngine();
