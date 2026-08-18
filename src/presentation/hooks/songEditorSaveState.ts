import { cloneEditableSong } from '../../domain/music/editor';
import type { Song } from '../../domain/music/Song';

export type SongEditorViewState = {
  readonly song: Song | null;
  readonly generation: number;
};

export function createSongEditorViewState(song: Song | null): SongEditorViewState {
  return { song, generation: 0 };
}

/**
 * Applies a local edit immediately and issues a save token for that snapshot.
 * Newer edits increment generation so older in-flight saves can be ignored.
 */
export function applyEditorMutation(
  state: SongEditorViewState,
  updater: (current: Song) => Song,
): {
  readonly state: SongEditorViewState;
  readonly persistSong: Song | null;
  readonly saveGeneration: number;
} {
  if (state.song === null) {
    return { state, persistSong: null, saveGeneration: state.generation };
  }

  const song = updater(state.song);
  const generation = state.generation + 1;

  return {
    state: { song, generation },
    persistSong: song,
    saveGeneration: generation,
  };
}

/**
 * Applies a completed save only when it matches the latest local generation.
 * Older completions leave the current editor snapshot unchanged.
 */
export function applyCompletedSave(
  state: SongEditorViewState,
  saveGeneration: number,
  saved: Song,
): SongEditorViewState {
  if (
    state.song === null ||
    saveGeneration !== state.generation ||
    saved.id !== state.song.id
  ) {
    return state;
  }

  return {
    generation: state.generation,
    song: cloneEditableSong(saved),
  };
}
