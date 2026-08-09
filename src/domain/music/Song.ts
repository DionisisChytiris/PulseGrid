import {
  DEFAULT_COUNT_IN_BARS,
  normalizeCountInBars,
  type CountInBars,
} from './countIn';
import { createSection, type Section } from './Section';
import { clampSongBpm, DEFAULT_SONG_BPM } from './songBpm';
import { sanitizeSongName } from './songName';

export interface Song {
  readonly id: string;
  readonly name: string;
  /**
   * Default display BPM for bars without a tempo override.
   * Per-bar `tempoDefinition` overrides this during compile/playback.
   */
  readonly defaultBpm: number;
  /**
   * Preparation bars before score playback begins.
   * Not part of the timeline score — applied only when Play starts.
   */
  readonly countInBars: CountInBars;
  readonly sections: readonly Section[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export type CreateSongInput = {
  id: string;
  name: string;
  defaultBpm?: number;
  countInBars?: CountInBars;
  sections?: readonly Section[];
  createdAt?: number;
  updatedAt?: number;
};

export function createSong(input: CreateSongInput): Song {
  const now = Date.now();

  return {
    id: input.id,
    name: sanitizeSongName(input.name),
    defaultBpm: clampSongBpm(input.defaultBpm ?? DEFAULT_SONG_BPM),
    countInBars: normalizeCountInBars(input.countInBars ?? DEFAULT_COUNT_IN_BARS),
    sections: input.sections ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
}
