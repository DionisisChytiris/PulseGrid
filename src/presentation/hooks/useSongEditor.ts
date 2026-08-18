import { useCallback, useEffect, useRef, useState } from 'react';

import {
  addBarToSong,
  cloneEditableSong,
  deleteBarFromSong,
  moveBarInSong,
  updateBarBpm,
  updateBarMeter,
  updateSongCountInBars,
  updateSongDefaultBpm,
  updateSongName,
} from '../../domain/music/editor';
import { createMeter, formatMeter } from '../../domain/music/Meter';
import type { CountInBars } from '../../domain/music/countIn';
import type { Song } from '../../domain/music/Song';
import { songRepository } from '../../domain/music/storage';
import { AnalyticsService } from '../../services/AnalyticsService';
import {
  applyCompletedSave,
  applyEditorMutation,
  createSongEditorViewState,
  type SongEditorViewState,
} from './songEditorSaveState';
import {
  setSegmentAccentPattern,
  setSegmentAccentPreset,
  setSegmentBarCount,
  setSegmentBpmOverride,
  setSegmentMeterLabel,
  deleteSegment,
  duplicateSegment,
  type TimelineSegment,
} from '../../components/songTimeline';

export function useSongEditor(songId: string) {
  const [editor, setEditor] = useState<SongEditorViewState>(() => createSongEditorViewState(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const inFlightSavesRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await songRepository.getSongById(songId);
      if (loaded === null) {
        generationRef.current = 0;
        setEditor(createSongEditorViewState(null));
        setError('Timeline not found');
        return;
      }

      const next = createSongEditorViewState(cloneEditableSong(loaded));
      generationRef.current = next.generation;
      setEditor(next);
      AnalyticsService.logTimelineOpened(loaded.id === 'demo-timeline-song');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load timeline');
    } finally {
      setLoading(false);
    }
  }, [songId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (nextSong: Song, saveGeneration: number) => {
    inFlightSavesRef.current += 1;
    setSaving(true);
    setError(null);

    try {
      const saved = await songRepository.updateSong(nextSong);
      setEditor((current) => applyCompletedSave(current, saveGeneration, saved));
    } catch (saveError) {
      if (saveGeneration === generationRef.current) {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save timeline');
      }
    } finally {
      inFlightSavesRef.current -= 1;
      if (inFlightSavesRef.current === 0) {
        setSaving(false);
      }
    }
  }, []);

  const applyAndSave = useCallback(
    (updater: (current: Song) => Song) => {
      setEditor((current) => {
        const result = applyEditorMutation(current, updater);
        generationRef.current = result.state.generation;
        if (result.persistSong !== null) {
          void persist(result.persistSong, result.saveGeneration);
        }
        return result.state;
      });
    },
    [persist],
  );

  return {
    song: editor.song,
    loading,
    saving,
    error,
    setSongName: (name: string) => applyAndSave((current) => updateSongName(current, name)),
    setSongDefaultBpm: (bpm: number) =>
      applyAndSave((current) => updateSongDefaultBpm(current, bpm)),
    setCountInBars: (countInBars: CountInBars) =>
      applyAndSave((current) => updateSongCountInBars(current, countInBars)),
    addBar: (meter?: Parameters<typeof addBarToSong>[1]) =>
      applyAndSave((current) => addBarToSong(current, meter)),
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
    setSegmentBarCount: (segment: TimelineSegment, count: number) =>
      applyAndSave((current) => setSegmentBarCount(current, segment, count)),
    setSegmentMeter: (segment: TimelineSegment, meterLabel: string) =>
      applyAndSave((current) => setSegmentMeterLabel(current, segment, meterLabel)),
    setSegmentBpmOverride: (segment: TimelineSegment, bpm: number | null) =>
      applyAndSave((current) => setSegmentBpmOverride(current, segment, bpm)),
    setSegmentAccent: (segment: TimelineSegment, presetId: string) =>
      applyAndSave((current) => setSegmentAccentPreset(current, segment, presetId)),
    setSegmentAccentPattern: (segment: TimelineSegment, pattern: readonly boolean[]) =>
      applyAndSave((current) => setSegmentAccentPattern(current, segment, pattern)),
    duplicateSegment: (segment: TimelineSegment) =>
      applyAndSave((current) => duplicateSegment(current, segment).song),
    deleteSegment: (segment: TimelineSegment): string | null => {
      let focusId: string | null = null;
      applyAndSave((current) => {
        const result = deleteSegment(current, segment);
        if (result.blockedReason !== undefined) {
          focusId = null;
          return current;
        }
        focusId =
          result.focusStartBarIndex === null
            ? null
            : `seg-${result.focusStartBarIndex}`;
        return result.song;
      });
      return focusId;
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
