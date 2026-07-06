import { compileSong } from '../../domain/music/compiler/SongPlaybackCompiler';
import { sliceCompiledPlaybackSequence } from '../../domain/music/compiler/sliceCompiledPlaybackSequence';
import type { Song } from '../../domain/music/Song';
import {
  createSongPlaybackCursor,
  createSongSchedulerAdapter,
} from '../../domain/music/playback';
import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import {
  songTimelineFallbackToQuick,
  songTimelinePlaybackPaused,
  songTimelinePlaybackResumed,
  songTimelinePlaybackStarted,
  songTimelinePlaybackStopped,
  songTimelineTickUpdated,
} from '../../features/songPlayback/songPlaybackSlice';
import { metronomeEngine } from '../../infrastructure/audio/MetronomeEngine';
import { PlaybackMode } from '../../infrastructure/audio/PlaybackMode';
import NativeAudioModule, {
  type NativeTickEvent,
} from '../../infrastructure/audio/NativeAudioModuleClient';
import type { AppDispatch } from '../../store';

import type { PlaybackService } from './PlaybackService';

type ActiveSongPlayback = {
  readonly song: Song;
  readonly fullCompiled: CompiledPlaybackSequence;
  readonly playbackStartIndex: number;
};

/**
 * Coordinates Song Timeline UI actions with existing MetronomeEngine APIs.
 * No timing logic — state transitions and native start/stop only.
 */
export class SongPlaybackService {
  private activePlayback: ActiveSongPlayback | null = null;

  private tickUnsubscribe: (() => void) | null = null;

  /** Next sequence index to resume from (tracked via native onTick, not JS cursor). */
  private playbackSequenceCursor = 0;

  private currentBarIndex = 0;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly quickMetronomePlayback: PlaybackService,
  ) {}

  async playSongTimeline(song: Song): Promise<void> {
    this.quickMetronomePlayback.stop();

    try {
      const compiled = compileSong(song);
      const cursor = createSongPlaybackCursor(compiled);
      const adapter = createSongSchedulerAdapter(cursor, compiled);

      await NativeAudioModule.whenReady?.();

      metronomeEngine.start({
        mode: PlaybackMode.SONG_TIMELINE,
        compiled,
        songAdapter: adapter,
        cursor,
        debugLog: __DEV__,
      });

      if (metronomeEngine.mode !== PlaybackMode.SONG_TIMELINE) {
        this.handleSongModeFallback(song, 'Song timeline start returned QUICK_METRONOME mode');
        return;
      }

      this.activePlayback = {
        song,
        fullCompiled: compiled,
        playbackStartIndex: 0,
      };
      this.playbackSequenceCursor = 0;

      this.attachTickListener();
      this.dispatch(
        songTimelinePlaybackStarted({
          songName: song.name,
          totalBars: compiled.metadata.totalBars,
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown song playback error';
      console.warn('[SongPlaybackService] Song mode failed:', reason);
      this.handleSongModeFallback(song, reason);
    }
  }

  pause(): void {
    if (!this.activePlayback) {
      return;
    }

    metronomeEngine.pauseSongTimeline();
    this.dispatch(songTimelinePlaybackPaused());
  }

  async resume(): Promise<void> {
    if (!this.activePlayback) {
      return;
    }

    const { song, fullCompiled } = this.activePlayback;
    const startIndex = this.playbackSequenceCursor;
    const sliced = sliceCompiledPlaybackSequence(fullCompiled, startIndex);

    if (sliced.events.length === 0) {
      this.stop();
      return;
    }

    const cursor = createSongPlaybackCursor(sliced);
    const adapter = createSongSchedulerAdapter(cursor, sliced);

    await NativeAudioModule.whenReady?.();

    metronomeEngine.resumeSongTimeline({
      mode: PlaybackMode.SONG_TIMELINE,
      compiled: sliced,
      songAdapter: adapter,
      cursor,
      debugLog: false,
    });

    this.activePlayback = {
      song,
      fullCompiled,
      playbackStartIndex: startIndex,
    };

    this.attachTickListener();
    this.dispatch(songTimelinePlaybackResumed());
  }

  stop(): void {
    this.detachTickListener();
    metronomeEngine.stop();
    this.activePlayback = null;
    this.playbackSequenceCursor = 0;
    this.currentBarIndex = 0;
    this.dispatch(songTimelinePlaybackStopped());
  }

  seekToBar(globalBarIndex: number): void {
    if (!this.activePlayback) {
      return;
    }

    const target = this.activePlayback.fullCompiled.events.find(
      (event) => event.globalBarIndex === globalBarIndex,
    );

    if (target === undefined) {
      return;
    }

    this.playbackSequenceCursor = target.sequence;
    this.currentBarIndex = target.globalBarIndex;
    metronomeEngine.session?.cursor.seekTo(target.sequence);

    if (metronomeEngine.isRunning) {
      void this.resumeFromSeek(target.sequence);
    } else {
      this.dispatch(
        songTimelineTickUpdated({
          barId: target.barId,
          sectionId: target.sectionId,
          bpm: target.bpm,
          sequenceIndex: target.sequence,
          currentBarIndex: target.globalBarIndex,
        }),
      );
    }
  }

  seekToPreviousBar(): void {
    if (!this.activePlayback) {
      return;
    }

    this.seekToBar(Math.max(0, this.currentBarIndex - 1));
  }

  seekToNextBar(): void {
    if (!this.activePlayback) {
      return;
    }

    const maxBar = this.activePlayback.fullCompiled.metadata.totalBars - 1;
    this.seekToBar(Math.min(maxBar, this.currentBarIndex + 1));
  }

  private async resumeFromSeek(absoluteSequence: number): Promise<void> {
    if (!this.activePlayback) {
      return;
    }

    const { song, fullCompiled } = this.activePlayback;
    const sliced = sliceCompiledPlaybackSequence(fullCompiled, absoluteSequence);

    if (sliced.events.length === 0) {
      this.stop();
      return;
    }

    const cursor = createSongPlaybackCursor(sliced);
    const adapter = createSongSchedulerAdapter(cursor, sliced);

    metronomeEngine.stop();
    await NativeAudioModule.whenReady?.();

    metronomeEngine.start({
      mode: PlaybackMode.SONG_TIMELINE,
      compiled: sliced,
      songAdapter: adapter,
      cursor,
      debugLog: false,
    });

    this.activePlayback = {
      song,
      fullCompiled,
      playbackStartIndex: absoluteSequence,
    };
    this.playbackSequenceCursor = absoluteSequence;

    this.attachTickListener();
    this.dispatch(songTimelinePlaybackResumed());
  }

  private handleSongModeFallback(song: Song, reason: string): void {
    console.warn(`[SongPlaybackService] Falling back to QUICK_METRONOME: ${reason}`);
    this.detachTickListener();
    this.activePlayback = null;

    this.dispatch(
      songTimelineFallbackToQuick({
        reason,
        songName: song.name,
      }),
    );

    this.quickMetronomePlayback.start();
  }

  private attachTickListener(): void {
    this.detachTickListener();

    const subscription = NativeAudioModule.addListener?.('onTick', (event: NativeTickEvent) => {
      this.handleNativeTick(event);
    });

    if (subscription) {
      this.tickUnsubscribe = () => subscription.remove();
    }
  }

  private detachTickListener(): void {
    this.tickUnsubscribe?.();
    this.tickUnsubscribe = null;
  }

  private handleNativeTick(event: NativeTickEvent): void {
    if (!this.activePlayback) {
      return;
    }

    const absoluteSequence = this.activePlayback.playbackStartIndex + event.sequence;
    const playbackEvent = this.activePlayback.fullCompiled.events[absoluteSequence];

    if (playbackEvent === undefined) {
      return;
    }

    this.playbackSequenceCursor = absoluteSequence + 1;
    this.currentBarIndex = playbackEvent.globalBarIndex;

    this.dispatch(
      songTimelineTickUpdated({
        barId: playbackEvent.barId,
        sectionId: playbackEvent.sectionId,
        bpm: playbackEvent.bpm,
        sequenceIndex: absoluteSequence,
        currentBarIndex: playbackEvent.globalBarIndex,
      }),
    );
  }
}
