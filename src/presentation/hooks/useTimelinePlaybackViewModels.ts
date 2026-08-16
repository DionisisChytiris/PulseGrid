import { useMemo } from 'react';

import {
  buildTimelineSegmentViewModels,
} from '../viewModels';
import { selectSongTimelineActiveForSong } from '../../features/songPlayback/songPlaybackSelectors';
import type { Song } from '../../domain/music/Song';
import { useAppSelector } from '../../store/hooks';

type Options = {
  song: Song;
  currentBarIndex: number;
  totalBars: number;
  songName: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  /** Preparation phase — timeline follow/LEDs stay idle until count-in completes. */
  isCountingIn?: boolean;
};

/**
 * Segment VMs + session flags for the Song Editor.
 *
 * Segment geometry is memoized on `song` only — bar/beat playback chrome is
 * applied inside SongSignatureTimeline via SongLine bar/beat stores (not by
 * rebuilding FlatList data when currentBarIndex changes).
 */
export function useTimelinePlaybackViewModels({
  song,
  currentBarIndex: _currentBarIndex,
  totalBars: _totalBars,
  songName,
  isPlaying,
  isPaused,
  isCountingIn = false,
}: Options) {
  const songSessionActive = useAppSelector((state) =>
    selectSongTimelineActiveForSong(state, song.name),
  );

  // Keep Signature Timeline idle during count-in; unlock when prep ends.
  const isTimelineActive = songSessionActive && !isCountingIn;

  const segments = useMemo(
    () => buildTimelineSegmentViewModels(song),
    [song],
  );

  const showTransport = songName === song.name && (isPlaying || isPaused);

  return {
    segments,
    isTimelineActive,
    showTransport,
  };
}
