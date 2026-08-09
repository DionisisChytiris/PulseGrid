import { pulseDurationMsFromDisplayBpm } from '../../domain/metronome/PulseGridSettings';
import { compileSong } from '../../domain/music/compiler/SongPlaybackCompiler';
import { sliceCompiledPlaybackSequence } from '../../domain/music/compiler/sliceCompiledPlaybackSequence';
import type { CompiledPlaybackSequence } from '../../domain/music/compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../../domain/music/compiler/PlaybackEvent';
import type { Song } from '../../domain/music/Song';
import { locateBarsInSong } from '../../domain/music/SongUtils';
import { normalizeCountInBars } from '../../domain/music/countIn';
import {
  buildCountInEvents,
  buildSeamlessCountInSession,
  createEntireSongLoop,
  createSongPlaybackCursor,
  createSongSchedulerAdapter,
  isCountInEvent,
  prependCountInToCompiled,
  SONG_LOOP_DISABLED,
  type SongLoopConfig,
} from '../../domain/music/playback';
import {
  songTimelineFallbackToQuick,
  songTimelinePlaybackPaused,
  songTimelinePlaybackResumed,
  songTimelinePlaybackStarted,
  songTimelinePlaybackStopped,
  songTimelineTickUpdated,
  type CountInProgressState,
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
  /** Score without count-in — seek / totalBars metadata. */
  readonly scoreCompiled: CompiledPlaybackSequence;
  /**
   * Stream loaded in the engine. May begin with a count-in prefix that is
   * excluded from native wrap via [loopStartIndex].
   */
  readonly sessionCompiled: CompiledPlaybackSequence;
  readonly countInEventCount: number;
  readonly countInBars: number;
  /** Native wrap target — first score event after preparation. */
  readonly loopStartIndex: number;
  readonly sessionBaseIndex: number;
  readonly seamlessLoop: boolean;
};

/**
 * Coordinates Song Timeline UI with MetronomeEngine.
 * Count-in is a leading prefix on the same scheduler; looping wraps score-only.
 */
export class SongPlaybackService {
  private activePlayback: ActiveSongPlayback | null = null;

  private tickUnsubscribe: (() => void) | null = null;

  private naturalCompletionTimer: ReturnType<typeof setTimeout> | null = null;

  private loopConfig: SongLoopConfig = SONG_LOOP_DISABLED;

  private playbackSequenceCursor = 0;

  private currentBarIndex = 0;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly quickMetronomePlayback: PlaybackService,
  ) {}

  setSongLoopEnabled(enabled: boolean): void {
    this.loopConfig = createEntireSongLoop(enabled);

    if (this.activePlayback?.seamlessLoop) {
      metronomeEngine.setTimelineLoops(enabled);
      if (enabled) {
        this.clearNaturalCompletionTimer();
      }
      return;
    }
  }

  get songLoopEnabled(): boolean {
    return this.loopConfig.enabled;
  }

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
   * Single scheduled stream: optional count-in prefix → score.
   * Loop wraps at [loopStartIndex] so preparation never repeats.
   */
  async playSongTimelineFromBar(song: Song, globalBarIndex: number): Promise<void> {
    this.clearNaturalCompletionTimer();
    this.quickMetronomePlayback.stop();
    this.detachTickListener();
    metronomeEngine.stop();

    try {
      const scoreCompiled = compileSong(song, { defaultBpm: song.defaultBpm });
      const safeBarIndex = Math.max(0, Math.floor(globalBarIndex));
      const target =
        scoreCompiled.events.find(
          (event) => event.globalBarIndex === safeBarIndex && event.beatIndexInBar === 0,
        ) ??
        scoreCompiled.events.find((event) => event.globalBarIndex === safeBarIndex) ??
        scoreCompiled.events[0];

      if (target === undefined) {
        this.handleSongModeFallback(song, 'Compiled song has no playback events');
        return;
      }

      const startSequence = target.sequence;
      const countInBars = normalizeCountInBars(song.countInBars);
      const templateBar =
        locateBarsInSong(song).find((located) => located.globalBarIndex === target.globalBarIndex)
          ?.bar ?? locateBarsInSong(song)[0]?.bar;

      if (templateBar === undefined) {
        this.handleSongModeFallback(song, 'Timeline has no bars for count-in');
        return;
      }

      const countInEvents = buildCountInEvents(templateBar, target.bpm, countInBars);
      const wantsLoop = this.loopConfig.enabled;

      let sessionCompiled: CompiledPlaybackSequence;
      let countInEventCount = countInEvents.length;
      let seamlessLoop = false;
      let loopStartIndex = 0;
      let timelineStartSequence = 0;

      if (wantsLoop) {
        if (countInEvents.length === 0) {
          sessionCompiled = scoreCompiled;
          countInEventCount = 0;
          loopStartIndex = 0;
          seamlessLoop = true;
          timelineStartSequence = startSequence;
        } else {
          const built = buildSeamlessCountInSession(scoreCompiled, startSequence, countInEvents);
          sessionCompiled = built.session;
          countInEventCount = built.countInEventCount;
          loopStartIndex = built.loopStartIndex;
          seamlessLoop = true;
          timelineStartSequence = 0;
        }
      } else {
        const suffix = sliceCompiledPlaybackSequence(scoreCompiled, startSequence);
        sessionCompiled = prependCountInToCompiled(suffix, countInEvents);
        loopStartIndex = countInEventCount;
      }

      if (sessionCompiled.events.length === 0) {
        this.handleSongModeFallback(song, 'No events remaining from start bar');
        return;
      }

      const cursorOptions = seamlessLoop
        ? {
            loopStartIndex,
            loopEndIndex: sessionCompiled.events.length - 1,
            debugLog: __DEV__,
          }
        : { debugLog: __DEV__ };

      const cursor = createSongPlaybackCursor(sessionCompiled, cursorOptions);
      if (seamlessLoop && timelineStartSequence > 0) {
        cursor.seekTo(timelineStartSequence);
      }
      const adapter = createSongSchedulerAdapter(cursor, sessionCompiled);

      await NativeAudioModule.whenReady?.();
      clickSoundService.syncBarStartEnabledToEngine(false);

      metronomeEngine.start({
        mode: PlaybackMode.SONG_TIMELINE,
        compiled: sessionCompiled,
        songAdapter: adapter,
        cursor,
        debugLog: __DEV__,
        timelineLoops: seamlessLoop,
        timelineStartSequence,
        timelineLoopStartSequence: loopStartIndex,
      });

      if (metronomeEngine.mode !== PlaybackMode.SONG_TIMELINE) {
        clickSoundService.restoreBarStartEnabledToEngine();
        this.handleSongModeFallback(song, 'Song timeline start returned QUICK_METRONOME mode');
        return;
      }

      const firstEvent =
        sessionCompiled.events[timelineStartSequence] ?? sessionCompiled.events[0]!;

      this.activePlayback = {
        song,
        scoreCompiled,
        sessionCompiled,
        countInEventCount,
        countInBars,
        loopStartIndex: seamlessLoop ? loopStartIndex : 0,
        sessionBaseIndex: 0,
        seamlessLoop,
      };
      this.playbackSequenceCursor = timelineStartSequence;
      this.currentBarIndex = isCountInEvent(firstEvent)
        ? target.globalBarIndex
        : firstEvent.globalBarIndex;

      this.attachTickListener();
      this.dispatch(
        songTimelinePlaybackStarted({
          songName: song.name,
          totalBars: scoreCompiled.metadata.totalBars,
        }),
      );
      this.dispatchTick(firstEvent, timelineStartSequence);
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
    const { sessionCompiled, seamlessLoop, loopStartIndex } = this.activePlayback;
    const startIndex = this.playbackSequenceCursor;
    const playbackCompiled = seamlessLoop
      ? sessionCompiled
      : sliceCompiledPlaybackSequence(sessionCompiled, startIndex);

    if (playbackCompiled.events.length === 0) {
      this.stop();
      return;
    }

    const cursorOptions = seamlessLoop
      ? {
          loopStartIndex,
          loopEndIndex: sessionCompiled.events.length - 1,
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
      timelineLoopStartSequence: loopStartIndex,
    });

    this.activePlayback = {
      ...this.activePlayback,
      sessionBaseIndex: seamlessLoop ? 0 : startIndex,
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

    const target = this.activePlayback.scoreCompiled.events.find(
      (event) => event.globalBarIndex === globalBarIndex,
    );

    if (target === undefined) {
      return;
    }

    this.currentBarIndex = target.globalBarIndex;

    const scoreOnly = this.activePlayback.scoreCompiled;
    const seamlessLoop = this.loopConfig.enabled;
    const sessionCompiled = seamlessLoop
      ? scoreOnly
      : sliceCompiledPlaybackSequence(scoreOnly, target.sequence);

    this.activePlayback = {
      ...this.activePlayback,
      sessionCompiled,
      countInEventCount: 0,
      countInBars: 0,
      loopStartIndex: 0,
      sessionBaseIndex: 0,
      seamlessLoop,
    };
    this.playbackSequenceCursor = seamlessLoop ? target.sequence : 0;

    metronomeEngine.session?.cursor.seekTo(seamlessLoop ? target.sequence : 0);

    if (metronomeEngine.isRunning) {
      void this.resumeFromSeek(seamlessLoop ? target.sequence : 0);
    } else {
      this.dispatchTick(target, seamlessLoop ? target.sequence : 0);
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

    const maxBar = this.activePlayback.scoreCompiled.metadata.totalBars - 1;
    this.seekToBar(Math.min(maxBar, this.currentBarIndex + 1));
  }

  private async resumeFromSeek(absoluteSequence: number): Promise<void> {
    if (!this.activePlayback) {
      return;
    }

    this.clearNaturalCompletionTimer();
    const { sessionCompiled } = this.activePlayback;
    const seamlessLoop = this.loopConfig.enabled;
    const playbackCompiled = seamlessLoop
      ? sessionCompiled
      : sliceCompiledPlaybackSequence(sessionCompiled, absoluteSequence);

    if (playbackCompiled.events.length === 0) {
      this.stop();
      return;
    }

    const cursorOptions = seamlessLoop
      ? {
          loopStartIndex: 0,
          loopEndIndex: sessionCompiled.events.length - 1,
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
      timelineLoopStartSequence: 0,
    });

    this.activePlayback = {
      ...this.activePlayback,
      sessionBaseIndex: 0,
      seamlessLoop,
      countInEventCount: 0,
      countInBars: 0,
      loopStartIndex: 0,
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

  private countInProgress(event: PlaybackEvent): CountInProgressState | null {
    if (!this.activePlayback || !isCountInEvent(event)) {
      return null;
    }

    return {
      barIndex: event.globalBarIndex,
      totalBars: this.activePlayback.countInBars,
      beatIndexInBar: event.beatIndexInBar,
      beatsPerMeasure: event.meter.numerator,
    };
  }

  private dispatchTick(event: PlaybackEvent, sessionIndex: number): void {
    const countingIn = isCountInEvent(event);
    this.dispatch(
      songTimelineTickUpdated({
        barId: event.barId,
        sectionId: event.sectionId,
        bpm: event.bpm,
        sequenceIndex: sessionIndex,
        currentBarIndex: countingIn ? this.currentBarIndex : event.globalBarIndex,
        beatIndexInBar: event.beatIndexInBar,
        beatsPerMeasure: event.meter.numerator,
        meterNumerator: event.meter.numerator,
        meterDenominator: event.meter.denominator,
        countIn: countingIn ? this.countInProgress(event) : null,
      }),
    );
  }

  private resolveSessionIndex(nativeSequence: number): number {
    if (!this.activePlayback) {
      return 0;
    }

    const { sessionCompiled, seamlessLoop, sessionBaseIndex, loopStartIndex } =
      this.activePlayback;
    const eventCount = sessionCompiled.events.length;
    if (eventCount <= 0) {
      return 0;
    }

    if (!seamlessLoop) {
      return sessionBaseIndex + nativeSequence;
    }

    // Match native: first pass 0..N-1, then wrap into [loopStart, N).
    if (nativeSequence >= 0 && nativeSequence < eventCount) {
      return nativeSequence;
    }

    const scoreLen = eventCount - loopStartIndex;
    if (scoreLen <= 0) {
      return 0;
    }

    const wrapped = nativeSequence - eventCount;
    const mod = ((wrapped % scoreLen) + scoreLen) % scoreLen;
    return loopStartIndex + mod;
  }

  private handleNativeTick(event: NativeTickEvent): void {
    if (!this.activePlayback) {
      return;
    }

    const eventCount = this.activePlayback.sessionCompiled.events.length;
    if (eventCount <= 0) {
      return;
    }

    const eventIndex = this.resolveSessionIndex(event.sequence);
    const playbackEvent = this.activePlayback.sessionCompiled.events[eventIndex];

    if (playbackEvent === undefined) {
      this.stop();
      return;
    }

    this.playbackSequenceCursor = eventIndex + 1;
    if (this.playbackSequenceCursor >= eventCount) {
      this.playbackSequenceCursor = this.activePlayback.seamlessLoop
        ? this.activePlayback.loopStartIndex
        : eventCount;
    }
    if (!isCountInEvent(playbackEvent)) {
      this.currentBarIndex = playbackEvent.globalBarIndex;
    }

    this.dispatchTick(playbackEvent, eventIndex);

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
