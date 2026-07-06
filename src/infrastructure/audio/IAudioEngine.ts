import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import type { SongPlaybackCursor, SongSchedulerAdapter } from '../../domain/music/playback';

/** Shared start configuration for native timing and audio engines. */
export type MetronomeStartConfig = {
  bpm: number;
  beatsPerMeasure: number;
  accentPattern: boolean[];
  subdivision: SubdivisionKind;
};

export type SongTimelineStartOptions = {
  songAdapter?: SongSchedulerAdapter;
  cursor?: SongPlaybackCursor;
  debugLog?: boolean;
};

/** Native audio engine contract — lifecycle, tempo, accent pattern, and subdivision. */
export interface IAudioEngine {
  initialize(): void;
  whenReady(): Promise<void>;
  start(config: MetronomeStartConfig): void;
  startSongTimeline?(compiled: CompiledPlaybackSequence, options?: SongTimelineStartOptions): void;
  stop(): void;
  setTempo(bpm: number): void;
  setAccentPattern(accentPattern: boolean[]): void;
  setSubdivision(subdivision: SubdivisionKind): void;
}
