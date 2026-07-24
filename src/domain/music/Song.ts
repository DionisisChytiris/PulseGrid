import { createSection, type Section } from './Section';
import { clampSongBpm, DEFAULT_SONG_BPM } from './songBpm';

export interface Song {
  readonly id: string;
  readonly name: string;
  /**
   * Default display BPM for bars without a tempo override.
   * Per-bar `tempoDefinition` overrides this during compile/playback.
   */
  readonly defaultBpm: number;
  readonly sections: readonly Section[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CreateSongInput = {
  id: string;
  name: string;
  defaultBpm?: number;
  sections?: readonly Section[];
  createdAt?: number;
  updatedAt?: number;
};

export function createSong(input: CreateSongInput): Song {
  const now = Date.now();

  return {
    id: input.id,
    name: input.name,
    defaultBpm: clampSongBpm(input.defaultBpm ?? DEFAULT_SONG_BPM),
    sections: input.sections ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
