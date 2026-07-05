import NativeAudioModule from './NativeAudioModuleClient';
import { audioDebugLog } from './audioDebugLog';
import type { INativeAudioBridge } from './INativeAudioBridge';

/**
 * JS bridge to the native NativeAudioModule.
 * Forwards lifecycle calls; native engine owns scheduling.
 */
export class NativeAudioBridge implements INativeAudioBridge {
  initialize(): void {
    audioDebugLog('NativeAudioBridge', 'initialize', '-> forwarding to native');
    NativeAudioModule.initialize?.();
  }

  start(): void {
    audioDebugLog('NativeAudioBridge', 'start', '-> forwarding to native (default 120 BPM)');
    NativeAudioModule.start({
      bpm: 120,
      beatsPerMeasure: 4,
      accentPattern: [true, false, false, false],
      subdivision: 'quarter',
    });
  }

  stop(): void {
    audioDebugLog('NativeAudioBridge', 'stop', '-> forwarding to native');
    NativeAudioModule.stop();
  }

  setTempo(bpm: number): void {
    audioDebugLog('NativeAudioBridge', 'setTempo', `bpm=${bpm} -> forwarding to native`);
    NativeAudioModule.setTempo(bpm);
  }

  setTimeSignature(numerator: number, denominator: number): void {
    audioDebugLog(
      'NativeAudioBridge',
      'setTimeSignature',
      `${numerator}/${denominator} (JS-only, not forwarded)`,
    );
  }

  playAccent(): void {
    audioDebugLog('NativeAudioBridge', 'playAccent', 'no-op — audio runs in native MetronomeEngine');
  }

  playNormal(): void {
    audioDebugLog('NativeAudioBridge', 'playNormal', 'no-op — audio runs in native MetronomeEngine');
  }

  dispose(): void {
    audioDebugLog('NativeAudioBridge', 'dispose', '-> calling stop()');
    this.stop();
  }
}

export const nativeAudioBridge = new NativeAudioBridge();
