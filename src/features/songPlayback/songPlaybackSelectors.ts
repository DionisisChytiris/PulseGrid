import type { RootState } from '../../store';

export const selectSongPlaybackMode = (state: RootState) => state.songPlayback.playbackMode;

export const selectSongPlaybackIsPlaying = (state: RootState) => state.songPlayback.isPlaying;

export const selectSongPlaybackIsPaused = (state: RootState) => state.songPlayback.isPaused;

export const selectSongPlaybackSongName = (state: RootState) => state.songPlayback.songName;

export const selectSongPlaybackFallbackReason = (state: RootState) => state.songPlayback.fallbackReason;

export const selectSongDebugTick = (state: RootState) => state.songPlayback.debugTick;

export const selectSongCurrentBarIndex = (state: RootState) => state.songPlayback.currentBarIndex;

export const selectSongTotalBars = (state: RootState) => state.songPlayback.totalBars;

export const selectSongPlaybackModeLabel = (state: RootState): string => {
  const mode = state.songPlayback.playbackMode;

  if (mode === 'SONG_TIMELINE') {
    return 'SONG TIMELINE';
  }

  if (mode === 'QUICK_METRONOME') {
    return 'QUICK METRONOME';
  }

  return 'IDLE';
};

export const selectIsSongTimelineMode = (state: RootState): boolean =>
  state.songPlayback.playbackMode === 'SONG_TIMELINE';

export const selectIsSongTimelinePlaying = (state: RootState): boolean =>
  state.songPlayback.playbackMode === 'SONG_TIMELINE' && state.songPlayback.isPlaying;

/** True when this song is the active SONG_TIMELINE target (playing or paused). */
export const selectSongTimelineActiveForSong = (
  state: RootState,
  songName: string,
): boolean =>
  state.songPlayback.playbackMode === 'SONG_TIMELINE' &&
  state.songPlayback.songName === songName &&
  (state.songPlayback.isPlaying || state.songPlayback.isPaused);
