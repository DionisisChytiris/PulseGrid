import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import type {
  SongPlaybackCursor,
  SongSchedulerAdapter,
} from '../../domain/music/playback';
import { toNativeSubdivision } from '../../domain/valueObjects/Subdivision';

import type { MetronomeStartConfig } from './IAudioEngine';
import { PlaybackMode } from './PlaybackMode';
import NativeAudioModule from './NativeAudioModuleClient';
import {
  startSongModeNativePlayback,
  stopSongModeSession,
  type SongModeSession,
} from './SongModeNativeBridge';

export type MetronomeEngineQuickStart = {
  readonly mode?: PlaybackMode.QUICK_METRONOME;
  readonly config: MetronomeStartConfig;
};

export type MetronomeEngineSongStart = {
  readonly mode: PlaybackMode.SONG_TIMELINE;
  readonly compiled: CompiledPlaybackSequence;
  readonly songAdapter?: SongSchedulerAdapter;
  readonly cursor?: SongPlaybackCursor;
  readonly debugLog?: boolean;
};

export type MetronomeEngineStartInput = MetronomeEngineQuickStart | MetronomeEngineSongStart;

/**
 * Application facade over native MetronomeEngine.
 * Quick mode delegates unchanged; song mode feeds the predictive scheduler via SongSchedulerAdapter.
 */
export class MetronomeEngine {
  private running = false;

  private songSession: SongModeSession | null = null;

  private activeMode: PlaybackMode = PlaybackMode.QUICK_METRONOME;

  get mode(): PlaybackMode {
    return this.activeMode;
  }

  get session(): SongModeSession | null {
    return this.songSession;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(input: MetronomeEngineStartInput): void {
    if (this.running) {
      this.stop();
    }

    if (input.mode === PlaybackMode.SONG_TIMELINE) {
      this.startSongTimeline(input);
      return;
    }

    this.startQuickMetronome(input.config);
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    stopSongModeSession(this.songSession);
    this.songSession = null;
    this.running = false;
    NativeAudioModule.stop();
  }

  /** Pauses native audio while preserving the song cursor position (UI orchestration only). */
  pauseSongTimeline(): void {
    this.songSession?.cursor.pause();

    if (this.running) {
      NativeAudioModule.stop();
      this.running = false;
    }
  }

  /** Resumes song timeline from the current cursor position. */
  resumeSongTimeline(input: MetronomeEngineSongStart): void {
    this.startSongTimeline(input);
  }

  private startQuickMetronome(config: MetronomeStartConfig): void {
    this.activeMode = PlaybackMode.QUICK_METRONOME;
    this.running = true;

    console.log('[MetronomeEngine] Playback mode: QUICK_METRONOME');

    NativeAudioModule.start({
      bpm: config.bpm,
      beatsPerMeasure: config.beatsPerMeasure,
      accentPattern: [...config.accentPattern],
      subdivision: toNativeSubdivision(config.subdivision),
      playbackMode: PlaybackMode.QUICK_METRONOME,
    });
  }

  private startSongTimeline(input: MetronomeEngineSongStart): void {
    if (input.songAdapter === undefined && input.compiled.events.length === 0) {
      console.warn('[MetronomeEngine] songAdapter null and empty compiled — fallback QUICK_METRONOME');
      this.startQuickMetronome({
        bpm: compiledDefaultBpm(input.compiled),
        beatsPerMeasure: 4,
        accentPattern: [true, false, false, false],
        subdivision: 'quarter',
      });
      return;
    }

    const result = startSongModeNativePlayback(input.compiled, {
      songAdapter: input.songAdapter,
      cursor: input.cursor,
      debugLog: input.debugLog,
    });

    if (result.mode === PlaybackMode.QUICK_METRONOME) {
      this.startQuickMetronome({
        bpm: compiledDefaultBpm(input.compiled),
        beatsPerMeasure: 4,
        accentPattern: [true, false, false, false],
        subdivision: 'quarter',
      });
      return;
    }

    this.activeMode = PlaybackMode.SONG_TIMELINE;
    this.songSession = result.session;
    this.running = true;
  }
}

function compiledDefaultBpm(compiled: CompiledPlaybackSequence): number {
  return compiled.metadata.defaultBpm;
}

export const metronomeEngine = new MetronomeEngine();
