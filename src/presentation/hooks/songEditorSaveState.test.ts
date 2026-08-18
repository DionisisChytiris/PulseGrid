import { createMeter } from '../../domain/music/Meter';
import { createSectionWithBars } from '../../domain/music/Section';
import { createSong, type Song } from '../../domain/music/Song';
import {
  updateBarMeter,
  updateSongDefaultBpm,
  updateSongName,
} from '../../domain/music/editor';
import { downbeatAccentPattern } from '../../domain/music/AccentPattern';

import {
  applyCompletedSave,
  applyEditorMutation,
  createSongEditorViewState,
  type SongEditorViewState,
} from './songEditorSaveState';

function createEditorSong(): Song {
  return createSong({
    id: 'song-1',
    name: 'Original',
    defaultBpm: 120,
    sections: [
      createSectionWithBars('main', 'Main', [
        {
          id: 'bar-1',
          meter: createMeter(4, 4),
          accentPattern: downbeatAccentPattern(4),
        },
      ]),
    ],
  });
}

function savedCopy(song: Song, updatedAt: number): Song {
  return { ...song, updatedAt };
}

type PendingSave = {
  generation: number;
  song: Song;
};

function edit(
  state: SongEditorViewState,
  updater: (current: Song) => Song,
  pending: PendingSave[],
): SongEditorViewState {
  const result = applyEditorMutation(state, updater);
  if (result.persistSong !== null) {
    pending.push({ generation: result.saveGeneration, song: result.persistSong });
  }
  return result.state;
}

function complete(
  state: SongEditorViewState,
  pending: PendingSave[],
  index: number,
  updatedAt: number,
): SongEditorViewState {
  const save = pending[index];
  if (save === undefined) {
    throw new Error(`No pending save at index ${index}`);
  }

  return applyCompletedSave(state, save.generation, savedCopy(save.song, updatedAt));
}

describe('songEditorSaveState', () => {
  it('keeps the latest BPM after rapid changes when older saves complete last', () => {
    const pending: PendingSave[] = [];
    let state = createSongEditorViewState(createEditorSong());

    for (const bpm of [121, 122, 123, 124, 125]) {
      state = edit(state, (song) => updateSongDefaultBpm(song, bpm), pending);
    }

    expect(state.song?.defaultBpm).toBe(125);

    state = complete(state, pending, 0, 1);
    state = complete(state, pending, 4, 5);
    state = complete(state, pending, 2, 3);
    state = complete(state, pending, 1, 2);
    state = complete(state, pending, 3, 4);

    expect(state.song?.defaultBpm).toBe(125);
    expect(state.song?.updatedAt).toBe(5);
  });

  it('keeps rename + BPM + meter when overlapping saves finish out of order', () => {
    const pending: PendingSave[] = [];
    let state = createSongEditorViewState(createEditorSong());

    state = edit(state, (song) => updateSongName(song, 'Renamed'), pending);
    state = edit(state, (song) => updateSongDefaultBpm(song, 140), pending);
    state = edit(state, (song) => updateBarMeter(song, 'bar-1', createMeter(3, 4)), pending);

    expect(state.song?.name).toBe('Renamed');
    expect(state.song?.defaultBpm).toBe(140);
    expect(state.song?.sections[0]?.bars[0]?.meter).toEqual(createMeter(3, 4));

    state = complete(state, pending, 1, 20);
    expect(state.song?.name).toBe('Renamed');
    expect(state.song?.defaultBpm).toBe(140);
    expect(state.song?.sections[0]?.bars[0]?.meter.numerator).toBe(3);

    state = complete(state, pending, 0, 10);
    expect(state.song?.defaultBpm).toBe(140);
    expect(state.song?.sections[0]?.bars[0]?.meter.numerator).toBe(3);

    state = complete(state, pending, 2, 30);
    expect(state.song?.name).toBe('Renamed');
    expect(state.song?.defaultBpm).toBe(140);
    expect(state.song?.sections[0]?.bars[0]?.meter).toEqual(createMeter(3, 4));
    expect(state.song?.updatedAt).toBe(30);
  });

  it('does not let a stale save replace newer local state while other saves are in flight', () => {
    const pending: PendingSave[] = [];
    let state = createSongEditorViewState(createEditorSong());

    state = edit(state, (song) => updateSongDefaultBpm(song, 130), pending);
    state = edit(state, (song) => updateSongDefaultBpm(song, 140), pending);

    state = complete(state, pending, 0, 1);
    expect(state.song?.defaultBpm).toBe(140);

    state = edit(state, (song) => updateSongName(song, 'After'), pending);
    state = complete(state, pending, 1, 2);
    expect(state.song?.name).toBe('After');
    expect(state.song?.defaultBpm).toBe(140);

    state = complete(state, pending, 2, 3);
    expect(state.song?.name).toBe('After');
    expect(state.song?.defaultBpm).toBe(140);
    expect(state.song?.updatedAt).toBe(3);
  });

  it('leaves state unchanged when no song is loaded', () => {
    const empty = createSongEditorViewState(null);
    const result = applyEditorMutation(empty, (song) => updateSongName(song, 'Nope'));

    expect(result.persistSong).toBeNull();
    expect(result.state).toBe(empty);
  });

  it('ignores a completed save for a different timeline', () => {
    const pending: PendingSave[] = [];
    let state = createSongEditorViewState(createEditorSong());
    state = edit(state, (song) => updateSongDefaultBpm(song, 140), pending);

    const other = savedCopy({ ...pending[0]!.song, id: 'song-other' }, 99);
    state = applyCompletedSave(state, pending[0]!.generation, other);

    expect(state.song?.id).toBe('song-1');
    expect(state.song?.defaultBpm).toBe(140);
  });
});
