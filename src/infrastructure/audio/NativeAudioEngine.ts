import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import { toNativeSubdivision, type SubdivisionKind } from '../../domain/valueObjects/Subdivision';

import type { IAudioEngine, MetronomeStartConfig, SongTimelineStartOptions } from './IAudioEngine';
import { PlaybackMode } from './PlaybackMode';
import {
  startSongModeNativePlayback,
  stopSongModeSession,
  type SongModeSession,
} from './SongModeNativeBridge';
import NativeAudioModule from './NativeAudioModuleClient';

/**
 * Native metronome lifecycle — start/stop/tempo/accent pattern.
 * Click playback runs on the native timing thread inside MetronomeEngine.
 */
export class NativeAudioEngine implements IAudioEngine {
  private isRunning = false;

  private songSession: SongModeSession | null = null;

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
      playbackMode: PlaybackMode.QUICK_METRONOME,
    });
  }

  startSongTimeline(compiled: CompiledPlaybackSequence, options?: SongTimelineStartOptions): void {
    if (this.isRunning) {
      this.hardStop();
    }

    const result = startSongModeNativePlayback(compiled, options);

    if (result.mode === PlaybackMode.QUICK_METRONOME) {
      this.isRunning = true;
      NativeAudioModule.start({
        bpm: compiled.metadata.defaultBpm,
        beatsPerMeasure: 4,
        accentPattern: [true, false, false, false],
        subdivision: 'quarter',
        playbackMode: PlaybackMode.QUICK_METRONOME,
      });
      return;
    }

    this.songSession = result.session;
    this.isRunning = true;
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.hardStop();
  }

  private hardStop(): void {
    this.isRunning = false;
    stopSongModeSession(this.songSession);
    this.songSession = null;
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
