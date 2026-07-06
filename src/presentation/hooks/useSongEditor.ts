import { useCallback, useEffect, useState } from 'react';

import {
  addBarToSong,
  cloneEditableSong,
  deleteBarFromSong,
  moveBarInSong,
  updateBarBpm,
  updateBarMeter,
  updateSongName,
} from '../../domain/music/editor';
import { createMeter, formatMeter } from '../../domain/music/Meter';
import type { Song } from '../../domain/music/Song';
import { songRepository } from '../../domain/music/storage';

export function useSongEditor(songId: string) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await songRepository.getSongById(songId);
      if (loaded === null) {
        setError('Song not found');
        setSong(null);
        return;
      }

      setSong(cloneEditableSong(loaded));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load song');
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (nextSong: Song) => {
    setSaving(true);
    setError(null);

    try {
      const saved = await songRepository.updateSong(nextSong);
      setSong(cloneEditableSong(saved));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save song');
    } finally {
      setSaving(false);
    }
  }, []);

  const applyAndSave = useCallback(
    (updater: (current: Song) => Song) => {
      setSong((current) => {
        if (current === null) {
          return current;
        }

        const next = updater(current);
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  return {
    song,
    loading,
    saving,
    error,
    setSongName: (name: string) => applyAndSave((current) => updateSongName(current, name)),
    addBar: () => applyAndSave((current) => addBarToSong(current)),
    deleteBar: (barId: string) => applyAndSave((current) => deleteBarFromSong(current, barId)),
    moveBarUp: (barId: string) => applyAndSave((current) => moveBarInSong(current, barId, 'up')),
    moveBarDown: (barId: string) => applyAndSave((current) => moveBarInSong(current, barId, 'down')),
    setBarMeter: (barId: string, meterLabel: string) => {
      const [numeratorText, denominatorText] = meterLabel.split('/');
      const numerator = Number(numeratorText);
      const denominator = Number(denominatorText);
      if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
        return;
      }

      applyAndSave((current) => updateBarMeter(current, barId, createMeter(numerator, denominator)));
    },
    setBarBpm: (barId: string, bpmText: string) => {
      const trimmed = bpmText.trim();
      if (trimmed.length === 0) {
        applyAndSave((current) => updateBarBpm(current, barId, null));
        return;
      }

      const bpm = Number(trimmed);
      if (!Number.isFinite(bpm) || bpm <= 0) {
        return;
      }

      applyAndSave((current) => updateBarBpm(current, barId, bpm));
    },
  };
}

export function meterOptions(): string[] {
  return ['4/4', '3/4', '7/8', '13/16'];
}

export function formatBarMeter(song: Song, barId: string): string {
  const bar = song.sections[0]?.bars.find((candidate) => candidate.id === barId);
  return bar === undefined ? '4/4' : formatMeter(bar.meter);
}
