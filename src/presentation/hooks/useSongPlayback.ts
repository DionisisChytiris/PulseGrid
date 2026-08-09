import type { Song } from '../../domain/music/Song';
import {
  selectSongCountIn,
  selectSongCurrentBarIndex,
  selectSongDebugTick,
  selectSongPlaybackFallbackReason,
  selectSongPlaybackIsPaused,
  selectSongPlaybackIsPlaying,
  selectSongPlaybackModeLabel,
  selectSongPlaybackSongName,
  selectSongTotalBars,
} from '../../features/songPlayback/songPlaybackSelectors';
import { useAppSelector } from '../../store/hooks';

import { songPlaybackService } from '../../application/services/songPlaybackServiceInstance';

export function useSongPlayback() {
  const modeLabel = useAppSelector(selectSongPlaybackModeLabel);
  const isPlaying = useAppSelector(selectSongPlaybackIsPlaying);
  const isPaused = useAppSelector(selectSongPlaybackIsPaused);
  const songName = useAppSelector(selectSongPlaybackSongName);
  const fallbackReason = useAppSelector(selectSongPlaybackFallbackReason);
  const debugTick = useAppSelector(selectSongDebugTick);
  const currentBarIndex = useAppSelector(selectSongCurrentBarIndex);
  const totalBars = useAppSelector(selectSongTotalBars);
  const countIn = useAppSelector(selectSongCountIn);
  const isCountingIn = countIn !== null;

  return {
    modeLabel,
    isPlaying,
    isPaused,
    songName,
    fallbackReason,
    debugTick,
    currentBarIndex,
    totalBars,
    countIn,
    isCountingIn,
    onPlaySong: (song: Song) => {
      void songPlaybackService.playSongTimeline(song);
    },
    onPlaySongFromBar: (song: Song, globalBarIndex: number) => {
      void songPlaybackService.playSongTimelineFromBar(song, globalBarIndex);
    },
    onPause: () => songPlaybackService.pause(),
    onResume: () => {
      void songPlaybackService.resume();
    },
    onStop: () => songPlaybackService.stop(),
    onSeekPreviousBar: () => songPlaybackService.seekToPreviousBar(),
    onSeekNextBar: () => songPlaybackService.seekToNextBar(),
    setSongLoopEnabled: (enabled: boolean) => {
      songPlaybackService.setSongLoopEnabled(enabled);
    },
  };
}
