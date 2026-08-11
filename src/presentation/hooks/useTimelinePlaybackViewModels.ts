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
 * Does not subscribe to per-beat debugTick — beat follow/LEDs are handled inside
 * SongSignatureTimeline via a Redux store subscription (avoids FlatList host
 * reconciliation every pulse).
 */
export function useTimelinePlaybackViewModels({
  song,
  currentBarIndex,
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

  const playbackContext = useMemo(
    () => ({
      currentBarIndex,
      isTimelineActive,
    }),
    [currentBarIndex, isTimelineActive],
  );

  const segments = useMemo(
    () => buildTimelineSegmentViewModels(song, playbackContext),
    [song, playbackContext],
  );

  const showTransport = songName === song.name && (isPlaying || isPaused);

  return {
    segments,
    isTimelineActive,
    showTransport,
  };
}
