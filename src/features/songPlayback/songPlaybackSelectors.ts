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
