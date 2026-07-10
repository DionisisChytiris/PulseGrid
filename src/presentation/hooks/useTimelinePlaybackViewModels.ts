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
};

export function useTimelinePlaybackViewModels({
  song,
  currentBarIndex,
  totalBars,
  songName,
  isPlaying,
  isPaused,
}: Options) {
  const debugTick = useAppSelector((state) => state.songPlayback.debugTick);

  const isTimelineActive = useAppSelector((state) =>
    selectSongTimelineActiveForSong(state, song.name),
  );

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
    if (debugTick === null) {
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
  }, [debugTick]);

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
