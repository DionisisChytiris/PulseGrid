import { pulseDurationMsFromDisplayBpm } from '../../domain/metronome/PulseGridSettings';
import { compileSong } from '../../domain/music/compiler/SongPlaybackCompiler';
import { sliceCompiledPlaybackSequence } from '../../domain/music/compiler/sliceCompiledPlaybackSequence';
import type { Song } from '../../domain/music/Song';
import {
  createEntireSongLoop,
  createSongPlaybackCursor,
  createSongSchedulerAdapter,
  SONG_LOOP_DISABLED,
  type SongLoopConfig,
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

import { clickSoundService } from './clickSoundServiceInstance';
import type { PlaybackService } from './PlaybackService';

type ActiveSongPlayback = {
  readonly song: Song;
  readonly fullCompiled: CompiledPlaybackSequence;
  /** Offset added to native sequence when playing a non-looping slice. */
  readonly playbackStartIndex: number;
  /** Native emits absolute sequences on the full score with seamless wrap. */
  readonly seamlessLoop: boolean;
};

/**
 * Coordinates Song Timeline UI actions with existing MetronomeEngine APIs.
 * No timing logic — state transitions and native start/stop only.
 */
export class SongPlaybackService {
  private activePlayback: ActiveSongPlayback | null = null;

  private tickUnsubscribe: (() => void) | null = null;

  /** Fires after the final beat so Redux matches native song completion (or loop restart). */
  private naturalCompletionTimer: ReturnType<typeof setTimeout> | null = null;

  /** Entire-song loop for now; startBar/endBar reserved for bar-range loops. */
  private loopConfig: SongLoopConfig = SONG_LOOP_DISABLED;

  /** Next sequence index to resume from (tracked via native onTick, not JS cursor). */
  private playbackSequenceCursor = 0;

  private currentBarIndex = 0;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly quickMetronomePlayback: PlaybackService,
  ) {}

  /** Enable/disable entire-song loop (phase 1). Keeps transport playing across cycles. */
  setSongLoopEnabled(enabled: boolean): void {
    this.loopConfig = createEntireSongLoop(enabled);

    if (this.activePlayback?.seamlessLoop) {
      // Already on the seamless full-score path — toggle wrap without rebuild.
      metronomeEngine.setTimelineLoops(enabled);
      if (enabled) {
        this.clearNaturalCompletionTimer();
      }
      return;
    }

    // Finite one-shot session: loop applies on the next Play (seamless native wrap).
  }

  get songLoopEnabled(): boolean {
    return this.loopConfig.enabled;
  }

  /** Future bar-range entry point — same loop system as entire-song. */
  setSongLoopConfig(config: SongLoopConfig): void {
    this.loopConfig = config.enabled
      ? {
          enabled: true,
          startBar: config.startBar,
          endBar: config.endBar,
        }
      : SONG_LOOP_DISABLED;
  }

  async playSongTimeline(song: Song): Promise<void> {
    await this.playSongTimelineFromBar(song, 0);
  }

  /**
   * Compile and start song playback at Beat 1 of [globalBarIndex] (0-based).
   * If already playing, restarts from the new position immediately.
   * When song loop is enabled, feeds the full score with native seamless wrap —
   * never stop/start at the loop boundary.
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
      const seamlessLoop = this.loopConfig.enabled;
      const playbackCompiled = seamlessLoop
        ? compiled
        : sliceCompiledPlaybackSequence(compiled, startSequence);

      if (playbackCompiled.events.length === 0) {
        this.handleSongModeFallback(song, 'No events remaining from start bar');
        return;
      }

      const cursorOptions = seamlessLoop
        ? {
            loopStartIndex: 0,
            loopEndIndex: compiled.events.length - 1,
            debugLog: __DEV__,
          }
        : { debugLog: __DEV__ };

      const cursor = createSongPlaybackCursor(playbackCompiled, cursorOptions);
      if (seamlessLoop && startSequence > 0) {
        cursor.seekTo(startSequence);
      }
      const adapter = createSongSchedulerAdapter(cursor, playbackCompiled);

      await NativeAudioModule.whenReady?.();

      // Song Timeline: disable BAR role at runtime only (no Redux / persist).
      clickSoundService.syncBarStartEnabledToEngine(false);

      metronomeEngine.start({
        mode: PlaybackMode.SONG_TIMELINE,
        compiled: playbackCompiled,
        songAdapter: adapter,
        cursor,
        debugLog: __DEV__,
        timelineLoops: seamlessLoop,
        timelineStartSequence: seamlessLoop ? startSequence : 0,
      });

      if (metronomeEngine.mode !== PlaybackMode.SONG_TIMELINE) {
        clickSoundService.restoreBarStartEnabledToEngine();
        this.handleSongModeFallback(song, 'Song timeline start returned QUICK_METRONOME mode');
        return;
      }

      this.activePlayback = {
        song,
        fullCompiled: compiled,
        playbackStartIndex: seamlessLoop ? 0 : startSequence,
        seamlessLoop,
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
    const seamlessLoop = this.loopConfig.enabled;
    const playbackCompiled = seamlessLoop
      ? fullCompiled
      : sliceCompiledPlaybackSequence(fullCompiled, startIndex);

    if (playbackCompiled.events.length === 0) {
      this.stop();
      return;
    }

    const cursorOptions = seamlessLoop
      ? {
          loopStartIndex: 0,
          loopEndIndex: fullCompiled.events.length - 1,
        }
      : undefined;
    const cursor = createSongPlaybackCursor(playbackCompiled, cursorOptions);
    if (seamlessLoop) {
      cursor.seekTo(startIndex);
    }
    const adapter = createSongSchedulerAdapter(cursor, playbackCompiled);

    await NativeAudioModule.whenReady?.();

    clickSoundService.syncBarStartEnabledToEngine(false);

    metronomeEngine.resumeSongTimeline({
      mode: PlaybackMode.SONG_TIMELINE,
      compiled: playbackCompiled,
      songAdapter: adapter,
      cursor,
      debugLog: false,
      timelineLoops: seamlessLoop,
      timelineStartSequence: seamlessLoop ? startIndex : 0,
    });

    this.activePlayback = {
      song,
      fullCompiled,
      playbackStartIndex: seamlessLoop ? 0 : startIndex,
      seamlessLoop,
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
    clickSoundService.restoreBarStartEnabledToEngine();
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
    const seamlessLoop = this.loopConfig.enabled;
    const playbackCompiled = seamlessLoop
      ? fullCompiled
      : sliceCompiledPlaybackSequence(fullCompiled, absoluteSequence);

    if (playbackCompiled.events.length === 0) {
      this.stop();
      return;
    }

    const cursorOptions = seamlessLoop
      ? {
          loopStartIndex: 0,
          loopEndIndex: fullCompiled.events.length - 1,
        }
      : undefined;
    const cursor = createSongPlaybackCursor(playbackCompiled, cursorOptions);
    if (seamlessLoop) {
      cursor.seekTo(absoluteSequence);
    }
    const adapter = createSongSchedulerAdapter(cursor, playbackCompiled);

    metronomeEngine.stop();
    await NativeAudioModule.whenReady?.();

    clickSoundService.syncBarStartEnabledToEngine(false);

    metronomeEngine.start({
      mode: PlaybackMode.SONG_TIMELINE,
      compiled: playbackCompiled,
      songAdapter: adapter,
      cursor,
      debugLog: false,
      timelineLoops: seamlessLoop,
      timelineStartSequence: seamlessLoop ? absoluteSequence : 0,
    });

    this.activePlayback = {
      song,
      fullCompiled,
      playbackStartIndex: seamlessLoop ? 0 : absoluteSequence,
      seamlessLoop,
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

    clickSoundService.restoreBarStartEnabledToEngine();

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
   * After the final beat of a finite pass (or a loop cycle that was disabled mid-play),
   * mirror manual Stop so follow/rAF tear down.
   */
  private scheduleNaturalCompletion(event: PlaybackEvent): void {
    this.clearNaturalCompletionTimer();
    if (this.loopConfig.enabled) {
      return;
    }

    const beatDurationMs = Math.max(
      1,
      pulseDurationMsFromDisplayBpm(event.bpm, event.meter.denominator),
    );

    this.naturalCompletionTimer = setTimeout(() => {
      this.naturalCompletionTimer = null;
      if (!this.activePlayback || this.loopConfig.enabled) {
        return;
      }

      this.stop();
    }, beatDurationMs);
  }

  private handleNativeTick(event: NativeTickEvent): void {
    if (!this.activePlayback) {
      return;
    }

    const eventCount = this.activePlayback.fullCompiled.events.length;
    if (eventCount <= 0) {
      return;
    }

    const absoluteSequence = this.activePlayback.seamlessLoop
      ? event.sequence
      : this.activePlayback.playbackStartIndex + event.sequence;

    const eventIndex = this.activePlayback.seamlessLoop
      ? ((absoluteSequence % eventCount) + eventCount) % eventCount
      : absoluteSequence;

    const playbackEvent = this.activePlayback.fullCompiled.events[eventIndex];

    if (playbackEvent === undefined) {
      this.stop();
      return;
    }

    this.playbackSequenceCursor = eventIndex + 1;
    if (this.playbackSequenceCursor >= eventCount) {
      this.playbackSequenceCursor = this.activePlayback.seamlessLoop ? 0 : eventCount;
    }
    this.currentBarIndex = playbackEvent.globalBarIndex;

    this.dispatch(
      songTimelineTickUpdated({
        barId: playbackEvent.barId,
        sectionId: playbackEvent.sectionId,
        bpm: playbackEvent.bpm,
        sequenceIndex: eventIndex,
        currentBarIndex: playbackEvent.globalBarIndex,
        beatIndexInBar: playbackEvent.beatIndexInBar,
        beatsPerMeasure: playbackEvent.meter.numerator,
        meterNumerator: playbackEvent.meter.numerator,
        meterDenominator: playbackEvent.meter.denominator,
      }),
    );

    const finishingFinitePass =
      !this.activePlayback.seamlessLoop && eventIndex >= eventCount - 1;
    const finishingDisabledLoopCycle =
      this.activePlayback.seamlessLoop &&
      !this.loopConfig.enabled &&
      eventIndex >= eventCount - 1;

    if (finishingFinitePass || finishingDisabledLoopCycle) {
      this.scheduleNaturalCompletion(playbackEvent);
    }
  }
}
