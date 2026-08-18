import AsyncStorage from '@react-native-async-storage/async-storage';

import { cloneSong } from '../SongUtils';
import type { Song } from '../Song';

import { AsyncStorageSongRepository } from './AsyncStorageSongRepository';

const STORAGE_KEY = 'pulsegrid:songs:v1';

type DelayedStore = {
  data: Map<string, string>;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * In-memory AsyncStorage with latency. After the first write (typically create),
 * the next setItem is slower than later ones so overlapping read-modify-write
 * would persist the stale snapshot last unless operations are serialized.
 */
function installDelayedAsyncStorage(): DelayedStore {
  const data = new Map<string, string>();
  let setItemStarts = 0;

  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
    const value = data.get(key) ?? null;
    await delay(15);
    return value;
  });

  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    setItemStarts += 1;
    const started = setItemStarts;
    // 2nd setItem overall (first mutation after create) finishes last if concurrent.
    await delay(started === 2 ? 40 : 8);
    data.set(key, value);
  });

  return { data };
}

function withBpm(song: Song, bpm: number): Song {
  return {
    ...cloneSong(song),
    defaultBpm: bpm,
  };
}

function withName(song: Song, name: string): Song {
  return {
    ...cloneSong(song),
    name,
  };
}

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

describe('AsyncStorageSongRepository write serialization', () => {
  let repo: AsyncStorageSongRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    installDelayedAsyncStorage();
    repo = new AsyncStorageSongRepository();
  });

  it('keeps the latest of two overlapping updates (older write cannot clobber newer)', async () => {
    const created = await repo.createSong({ name: 'Original' });

    const older = withName(created, 'Older name');
    const newer = withBpm(withName(created, 'Newer name'), 140);

    const first = repo.updateSong(older);
    const second = repo.updateSong(newer);
    await Promise.all([first, second]);

    const loaded = await repo.getSongById(created.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.name).toBe('Newer name');
    expect(loaded?.defaultBpm).toBe(140);
  });

  it('does not restore a song when update is followed by overlapping delete', async () => {
    const created = await repo.createSong({ name: 'To delete' });
    const renamed = withName(created, 'Renamed then deleted');

    const update = repo.updateSong(renamed);
    const remove = repo.deleteSong(created.id);
    await Promise.all([update, remove]);

    expect(await repo.getSongById(created.id)).toBeNull();
  });

  it('applies rapid create/update/delete in call order', async () => {
    const first = await repo.createSong({ name: 'Keep-me' });

    const createSecond = repo.createSong({ name: 'Second' });
    const renameFirst = repo.updateSong(withName(first, 'Keep-me-renamed'));
    const deleteFirst = repo.deleteSong(first.id);
    const [second] = await Promise.all([createSecond, renameFirst, deleteFirst]);

    expect(await repo.getSongById(first.id)).toBeNull();
    const loadedSecond = await repo.getSongById(second.id);
    expect(loadedSecond?.name).toBe('Second');
  });

  it('preserves an unrelated song while another song is updated concurrently', async () => {
    const alpha = await repo.createSong({ name: 'Alpha' });
    const beta = await repo.createSong({ name: 'Beta' });

    const updateAlpha = repo.updateSong(withBpm(alpha, 90));
    const updateBeta = repo.updateSong(withName(beta, 'Beta Two'));
    await Promise.all([updateAlpha, updateBeta]);

    expect((await repo.getSongById(alpha.id))?.defaultBpm).toBe(90);
    expect((await repo.getSongById(beta.id))?.name).toBe('Beta Two');
  });

  it('continues the queue after a failed update', async () => {
    const created = await repo.createSong({ name: 'Alive' });

    await expect(
      repo.updateSong({ ...created, id: 'missing-id' }),
    ).rejects.toThrow('Timeline not found: missing-id');

    const updated = await repo.updateSong(withName(created, 'Still writable'));
    expect(updated.name).toBe('Still writable');
    expect((await repo.getSongById(created.id))?.name).toBe('Still writable');
  });

  it('writes a single songs blob under the versioned key', async () => {
    await repo.createSong({ name: 'One' });
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );
  });
});

describe('AsyncStorageSongRepository corrupt payload loading', () => {
  let repo: AsyncStorageSongRepository;
  let data: Map<string, string>;

  function validStoredSong(id: string, name: string): unknown {
    return {
      id,
      name,
      defaultBpm: 120,
      countInBars: 2,
      createdAt: 1,
      updatedAt: 1,
      sections: [
        {
          id: `${id}-sec`,
          name: 'Main',
          loop: false,
          bars: [
            {
              id: `${id}-bar`,
              meter: { numerator: 4, denominator: 4, grouping: [4] },
              accentPattern: { kind: 'steps', steps: [true, false, false, false] },
              repeatCount: 1,
            },
          ],
        },
      ],
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    data = new Map<string, string>();

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      return data.get(key) ?? null;
    });
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      data.set(key, value);
    });

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    repo = new AsyncStorageSongRepository();
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it('returns valid timelines when one stored song is corrupted', async () => {
    data.set(
      STORAGE_KEY,
      JSON.stringify([
        validStoredSong('keep', 'Keep'),
        { id: 'broken' },
        validStoredSong('keep-two', 'Keep Two'),
      ]),
    );

    const songs = await repo.getAllSongs();
    expect(songs.map((song) => song.id).sort()).toEqual(['keep', 'keep-two']);
  });

  it('does not throw or seed demo when AsyncStorage contains invalid JSON', async () => {
    data.set(STORAGE_KEY, '{broken');

    await expect(repo.getAllSongs()).resolves.toEqual([]);
    expect(data.get(STORAGE_KEY)).toBe('{broken');
  });

  it('backs up unreadable JSON before a later write replaces it', async () => {
    data.set(STORAGE_KEY, '{broken');

    await repo.createSong({ name: 'Fresh' });

    expect(data.get('pulsegrid:songs:v1:unreadable')).toBe('{broken');
    const persisted = JSON.parse(data.get(STORAGE_KEY) ?? '[]') as unknown[];
    expect(persisted).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Fresh' })]),
    );
  });

  it('keeps an unreadable entry in storage after an unrelated create', async () => {
    const broken = { id: 'broken' };
    data.set(STORAGE_KEY, JSON.stringify([validStoredSong('keep', 'Keep'), broken]));

    await repo.createSong({ name: 'Fresh' });

    const persisted = JSON.parse(data.get(STORAGE_KEY) ?? '[]') as unknown[];
    expect(persisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'keep' }),
        expect.objectContaining({ name: 'Fresh' }),
        broken,
      ]),
    );
  });
});
