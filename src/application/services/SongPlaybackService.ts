import { pulseDurationMsFromDisplayBpm } from '../../domain/metronome/PulseGridSettings';
import { compileSong } from '../../domain/music/compiler/SongPlaybackCompiler';
import { sliceCompiledPlaybackSequence } from '../../domain/music/compiler/sliceCompiledPlaybackSequence';
import type { Song } from '../../domain/music/Song';
import {
  createSongPlaybackCursor,
  createSongSchedulerAdapter,
} from '../../domain/music/playback';
import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../../domain/music/compiler/PlaybackEvent';
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

  /** Fires after the final beat so Redux matches native song completion. */
  private naturalCompletionTimer: ReturnType<typeof setTimeout> | null = null;

  /** Next sequence index to resume from (tracked via native onTick, not JS cursor). */
  private playbackSequenceCursor = 0;

  private currentBarIndex = 0;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly quickMetronomePlayback: PlaybackService,
  ) {}

  async playSongTimeline(song: Song): Promise<void> {
    await this.playSongTimelineFromBar(song, 0);
  }

  /**
   * Compile and start song playback at Beat 1 of [globalBarIndex] (0-based).
   * If already playing, restarts from the new position immediately.
   */
  async playSongTimelineFromBar(song: Song, globalBarIndex: number): Promise<void> {
    this.clearNaturalCompletionTimer();
    this.quickMetronomePlayback.stop();
    this.detachTickListener();
    metronomeEngine.stop();

    try {
      const compiled = compileSong(song, { defaultBpm: song.defaultBpm });
      const safeBarIndex = Math.max(0, Math.floor(globalBarIndex));
      const target =
        compiled.events.find(
          (event) => event.globalBarIndex === safeBarIndex && event.beatIndexInBar === 0,
        ) ??
        compiled.events.find((event) => event.globalBarIndex === safeBarIndex) ??
        compiled.events[0];

      if (target === undefined) {
        this.handleSongModeFallback(song, 'Compiled song has no playback events');
        return;
      }

      const startSequence = target.sequence;
      const sliced = sliceCompiledPlaybackSequence(compiled, startSequence);

      if (sliced.events.length === 0) {
        this.handleSongModeFallback(song, 'No events remaining from start bar');
        return;
      }

      const cursor = createSongPlaybackCursor(sliced);
      const adapter = createSongSchedulerAdapter(cursor, sliced);

      await NativeAudioModule.whenReady?.();

      metronomeEngine.start({
        mode: PlaybackMode.SONG_TIMELINE,
        compiled: sliced,
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
        playbackStartIndex: startSequence,
      };
      this.playbackSequenceCursor = startSequence;
      this.currentBarIndex = target.globalBarIndex;

      this.attachTickListener();
      this.dispatch(
        songTimelinePlaybackStarted({
          songName: song.name,
          totalBars: compiled.metadata.totalBars,
        }),
      );
      this.dispatch(
        songTimelineTickUpdated({
          barId: target.barId,
          sectionId: target.sectionId,
          bpm: target.bpm,
          sequenceIndex: startSequence,
          currentBarIndex: target.globalBarIndex,
          beatIndexInBar: target.beatIndexInBar,
          beatsPerMeasure: target.meter.numerator,
          meterNumerator: target.meter.numerator,
          meterDenominator: target.meter.denominator,
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

    this.clearNaturalCompletionTimer();
    metronomeEngine.pauseSongTimeline();
    this.dispatch(songTimelinePlaybackPaused());
  }

  async resume(): Promise<void> {
    if (!this.activePlayback) {
      return;
    }

    this.clearNaturalCompletionTimer();
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
    this.clearNaturalCompletionTimer();
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
          beatIndexInBar: target.beatIndexInBar,
          beatsPerMeasure: target.meter.numerator,
          meterNumerator: target.meter.numerator,
          meterDenominator: target.meter.denominator,
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

    this.clearNaturalCompletionTimer();
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
    this.clearNaturalCompletionTimer();
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

  private clearNaturalCompletionTimer(): void {
    if (this.naturalCompletionTimer !== null) {
      clearTimeout(this.naturalCompletionTimer);
      this.naturalCompletionTimer = null;
    }
  }

  /**
   * Native finishes the finite timeline without a JS completion event.
   * After the final beat's duration, mirror manual Stop so follow/rAF tear down.
   */
  private scheduleNaturalCompletion(event: PlaybackEvent): void {
    this.clearNaturalCompletionTimer();
    const beatDurationMs = Math.max(
      1,
      pulseDurationMsFromDisplayBpm(event.bpm, event.meter.denominator),
    );

    this.naturalCompletionTimer = setTimeout(() => {
      this.naturalCompletionTimer = null;
      if (!this.activePlayback) {
        return;
      }

      if (
        this.playbackSequenceCursor >= this.activePlayback.fullCompiled.events.length
      ) {
        this.stop();
      }
    }, beatDurationMs);
  }

  private handleNativeTick(event: NativeTickEvent): void {
    if (!this.activePlayback) {
      return;
    }

    const absoluteSequence = this.activePlayback.playbackStartIndex + event.sequence;
    const playbackEvent = this.activePlayback.fullCompiled.events[absoluteSequence];

    if (playbackEvent === undefined) {
      // Past compiled end — native may still emit a sentinel; stop follow/UI state.
      this.stop();
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
        beatIndexInBar: playbackEvent.beatIndexInBar,
        beatsPerMeasure: playbackEvent.meter.numerator,
        meterNumerator: playbackEvent.meter.numerator,
        meterDenominator: playbackEvent.meter.denominator,
      }),
    );

    if (absoluteSequence >= this.activePlayback.fullCompiled.events.length - 1) {
      this.scheduleNaturalCompletion(playbackEvent);
    }
  }
}
