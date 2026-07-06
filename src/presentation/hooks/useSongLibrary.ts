import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import type { Song } from '../../domain/music/Song';
import { songRepository } from '../../domain/music/storage';

export function useSongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextSongs = await songRepository.getAllSongs();
      setSongs(nextSongs);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load songs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const createSong = useCallback(async (name: string) => {
    const created = await songRepository.createSong({ name });
    await reload();
    return created;
  }, [reload]);

  const deleteSong = useCallback(
    async (id: string) => {
      await songRepository.deleteSong(id);
      await reload();
    },
    [reload],
  );

  return {
    songs,
    loading,
    error,
    reload,
    createSong,
    deleteSong,
  };
}
