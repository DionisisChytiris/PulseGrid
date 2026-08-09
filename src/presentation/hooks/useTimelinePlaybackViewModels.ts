import { useMemo } from 'react';

import {
  buildPlaybackStatusViewModel,
  buildTimelineSegmentViewModels,
  type PlaybackTickContext,
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

export function useTimelinePlaybackViewModels({
  song,
  currentBarIndex,
  totalBars,
  songName,
  isPlaying,
  isPaused,
  isCountingIn = false,
}: Options) {
  const debugTick = useAppSelector((state) => state.songPlayback.debugTick);

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

  const tickContext: PlaybackTickContext = useMemo(() => {
    if (debugTick === null || isCountingIn) {
      return {
        beatIndexInBar: null,
        beatsPerMeasure: null,
        bpm: null,
        meterLabel: null,
        sectionId: null,
      };
    }

    return {
      beatIndexInBar: debugTick.beatIndexInBar,
      beatsPerMeasure: debugTick.beatsPerMeasure,
      bpm: debugTick.bpm,
      meterLabel: `${debugTick.meterNumerator}/${debugTick.meterDenominator}`,
      sectionId: debugTick.sectionId,
    };
  }, [debugTick, isCountingIn]);

  const playbackStatus = useMemo(
    () =>
      buildPlaybackStatusViewModel(song, {
        ...playbackContext,
        totalBars,
        tick: tickContext,
      }),
    [song, playbackContext, totalBars, tickContext],
  );

  const showTransport = songName === song.name && (isPlaying || isPaused);

  return {
    segments,
    playbackStatus,
    isTimelineActive,
    showTransport,
  };
}
