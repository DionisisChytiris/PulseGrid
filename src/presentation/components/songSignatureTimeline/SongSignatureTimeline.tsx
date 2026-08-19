import {
  Fragment,
  Profiler,
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ProfilerOnRenderCallback,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native';
import Animated, {
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

import { SegmentEditBottomSheet } from '../../../components/songTimeline/SegmentEditBottomSheet';
import { AUTO_FOLLOW_SUSPEND_MS } from '../../../components/songTimeline/timelineConstants';
import type { TimelineSegment } from '../../../components/songTimeline/types';
import type { Meter } from '../../../domain/music/Meter';
import type { CountInBars } from '../../../domain/music/countIn';
import type { Song } from '../../../domain/music/Song';
import { pulseDurationMsFromDisplayBpm } from '../../../domain/metronome/PulseGridSettings';
import { findDomainSegmentById } from '../../viewModels/buildTimelineSegmentViewModels';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { store } from '../../../store';
import { studioColors } from '../../theme';

import { MeterRegion } from './MeterRegion';
import { NewBarMeterDialog } from './NewBarMeterDialog';
import { overviewTempoMarkings, effectiveSegmentBpm } from './overviewTempoMarkings';
import { setSongLineBarIndex, setSongLineBeatIndex } from './SongLineBeatContext';
import {
  advanceFollowCursor,
  createFollowCursor,
  followScrollBeatPosition,
  hardSyncFollowCursorToAudio,
  applyAudioTickToFollowCursor,
  type FollowCursorState,
} from './songLineFollowCursor';
import {
  TEMP_ENABLE_FOLLOW_SCROLL_PROFILER,
  TEMP_ENABLE_PROFILER_CONSOLE_LOGS,
  followProfiler,
  profileRender,
} from './songLineFollowProfiler';
import {
  TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER,
  getItemLayoutTracer,
} from './getItemLayoutTracer';
import {
  BAR_CELL_PADDING_V,
  REGION_GAP,
  TRACK_HEIGHT,
  barCellWidth,
  parseMeterDenominator,
} from './signatureTimelineConstants';

import { firstGlobalBarIndexForNavigatorSectionIndex } from './sectionNavigatorScroll';
import {
  clampCenteredBarScrollOffset,
  segmentStride,
} from './timelineScrollGeometry';

type Props = {
  song: Song;
  segments: readonly TimelineSegmentViewModel[];
  isTimelineActive: boolean;
  isPlaying: boolean;
  currentBarIndex: number;
  onSegmentBarCountChange: (segment: TimelineSegment, count: number) => void;
  onSegmentMeterChange: (segment: TimelineSegment, meterLabel: string) => void;
  onSegmentBpmOverrideChange: (segment: TimelineSegment, bpm: number | null) => void;
  onSegmentAccentPatternChange: (segment: TimelineSegment, pattern: boolean[]) => void;
  onSegmentDuplicate: (segment: TimelineSegment) => void;
  onSegmentDelete: (segment: TimelineSegment) => string | null;
  onCreateSection: (segment: TimelineSegment, name: string) => void;
  onRemoveSection: (segment: TimelineSegment) => void;
  onSongDefaultBpmChange: (bpm: number) => void;
  onCountInBarsChange: (bars: CountInBars) => void;
  onPlayFromSegment: (segment: TimelineSegmentViewModel) => void;
  onAddBar: (meter: Meter) => void;
  /** Entire-song loop — subtle highlight on the time-signature lane. */
  songLoopEnabled?: boolean;
};

/** Imperative API for toolbar actions (e.g. Edit button). */
export type SongSignatureTimelineHandle = {
  openEditSegment: () => void;
  /**
   * Programmatically scrolls the horizontal timeline to Bar 1 (offset 0).
   * Resolves immediately if already at the start; otherwise waits until the
   * animated scroll settles (or a short safety timeout).
   */
  scrollToStart: () => Promise<void>;
  /** Centers the first bar of a Section Navigator row in the timeline viewport. */
  scrollToNavigatorSection: (navigatorSectionIndex: number) => void;
};

type TempoEditFocus = 'song' | 'segment' | null;

/** Treat offsets at or below this as “already at Bar 1”. */
const SCROLL_START_EPSILON_PX = 1;
/** Max wait for animated scrollToOffset(0) before starting playback anyway. */
const SCROLL_TO_START_TIMEOUT_MS = 450;

/**
 * TEMP A/B EXPERIMENT — beat-dot highlight kill-switch.
 * true  = force idle LED appearance (no active-beat update) to test scroll hitch.
 * false = normal highlighting. Revert by setting false or deleting this flag + gate.
 * A/B result: disabling highlight reduced hitch slightly but did NOT eliminate it.
 */
const TEMP_DISABLE_SONG_LINE_BEAT_HIGHLIGHT = false;

/**
 * TEMP A/B EXPERIMENT — UI-thread follow-scroll (Reanimated scrollTo).
 * true  = rAF advances the follow cursor on JS, then applies offset via UI-thread scrollTo.
 * false = baseline: rAF + FlatList.scrollToOffset({ animated: false }) on the JS thread.
 * Requires a native rebuild after adding react-native-reanimated.
 */
const USE_UI_THREAD_FOLLOW_SCROLL = true;

/**
 * TEMP A/B EXPERIMENT — non-virtualized timeline during follow playback only.
 * true  = while timeline is actively playing, render regions in Animated.ScrollView
 *         (all items mounted; no FlatList windowing / getItemLayout).
 * false = always FlatList (current production path).
 * Editing / stopped timeline keeps FlatList when this is true.
 */
const USE_NON_VIRTUALIZED_PLAYBACK_TIMELINE = true;

/**
 * Shared coordinate system: pulse N is anchored at N * beatWidth (on the grid
 * line for the first pulse of each quarter-note group). Fractional beats
 * interpolate between consecutive pulse anchors.
 * Beat positions may cross bar boundaries — they are normalized first so follow
 * does not stall at beatsInBar - epsilon.
 */
function playbackScrollOffset(
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  beatPosition: number,
): number {
  const normalized = followScrollBeatPosition(segments, barIndex, beatPosition);
  let offset = 0;

  for (const segment of segments) {
    const segmentStartIndex = segment.startBar - 1;
    const segmentEndIndex = segment.endBar - 1;
    const beatsInBar = Math.max(1, segment.accentPreview.length);
    const denominator = parseMeterDenominator(segment.meter);
    const cellWidth = barCellWidth(beatsInBar, denominator);
    const beatWidth = cellWidth / beatsInBar;

    if (
      normalized.barIndex >= segmentStartIndex &&
      normalized.barIndex <= segmentEndIndex
    ) {
      return (
        offset +
        (normalized.barIndex - segmentStartIndex) * cellWidth +
        normalized.beatPosition * beatWidth
      );
    }

    offset += segmentStride(segment);
  }

  return offset;
}

function pulseDurationMs(bpm: number | null, meterLabel: string): number {
  const safeBpm = bpm !== null && bpm > 0 ? bpm : 120;
  const denominator = Number(meterLabel.split('/')[1]) || 4;
  return pulseDurationMsFromDisplayBpm(safeBpm, denominator);
}

/**
 * Cubase-style Signature Track: horizontal meter regions from Song segments.
 * Beat ticks are consumed via Redux store.subscribe (not React props) so the
 * FlatList host does not reconcile on every pulse; LEDs use SongLineBeatContext.
 */
export const SongSignatureTimeline = memo(
  forwardRef<SongSignatureTimelineHandle, Props>(function SongSignatureTimeline(
    {
      song,
      segments,
      isTimelineActive,
      isPlaying,
      currentBarIndex,
      onSegmentBarCountChange,
      onSegmentMeterChange,
      onSegmentBpmOverrideChange,
      onSegmentAccentPatternChange,
      onSegmentDuplicate,
      onSegmentDelete,
      onCreateSection,
      onRemoveSection,
      onSongDefaultBpmChange,
      onCountInBarsChange,
      onPlayFromSegment,
      onAddBar,
      songLoopEnabled = false,
    },
    ref,
  ) {
  const flatListRef = useAnimatedRef<FlatList<TimelineSegmentViewModel>>();
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  /** 1 while non-virtualized ScrollView follow path is mounted. */
  const useScrollViewFollowSV = useSharedValue(0);
  /** Desired horizontal follow offset; UI-thread reaction calls Reanimated scrollTo. */
  const followScrollX = useSharedValue(0);
  /** DEV profiler SharedValues — drained on JS; no-op work when profiling inactive. */
  const profileActiveSV = useSharedValue(0);
  const uiFrameCountSV = useSharedValue(0);
  const uiFrameSumSV = useSharedValue(0);
  const uiFrameMaxSV = useSharedValue(0);
  const uiLong20SV = useSharedValue(0);
  const uiLong24SV = useSharedValue(0);
  const uiLong32SV = useSharedValue(0);
  const uiScrollExecSV = useSharedValue(0);
  const autoFollowSuspendedUntil = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const uiFollowRefVerifiedRef = useRef(false);
  /** Last known horizontal content offset (for scroll-to-start waits). */
  const scrollOffsetRef = useRef(0);
  /** Shared in-flight scrollToStart promise (dedupes overlapping Play presses). */
  const scrollToStartPromiseRef = useRef<Promise<void> | null>(null);
  const scrollToStartResolveRef = useRef<(() => void) | null>(null);
  const scrollToStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last segment opened via tap / Edit — survives sheet close. */
  const selectedSegmentIdRef = useRef<string | null>(null);
  const playbackCursorRef = useRef<FollowCursorState>(createFollowCursor());
  const segmentsRef = useRef(segments);
  const isTimelineActiveRef = useRef(isTimelineActive);
  const isPlayingRef = useRef(isPlaying);
  const currentBarIndexRef = useRef(currentBarIndex);
  const wasTimelineActiveRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const lastTickKeyRef = useRef<string | null>(null);
  const applyTransportFromStoreRef = useRef<() => void>(() => {});
  const [viewportWidth, setViewportWidth] = useState(0);
  const [segmentEditorVisible, setSegmentEditorVisible] = useState(false);
  const [focusSegmentId, setFocusSegmentId] = useState<string | null>(null);
  const [focusTempoEdit, setFocusTempoEdit] = useState<TempoEditFocus>(null);
  const [newBarDialogVisible, setNewBarDialogVisible] = useState(false);

  const tempoMarkings = useMemo(
    () => overviewTempoMarkings(segments, song.defaultBpm),
    [segments, song.defaultBpm],
  );

  segmentsRef.current = segments;
  isTimelineActiveRef.current = isTimelineActive;
  isPlayingRef.current = isPlaying;
  currentBarIndexRef.current = currentBarIndex;

  if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
    profileRender('SongSignatureTimeline');
  }

  // DEV: start/stop profiler with follow playback (not count-in-only inactive timeline).
  useEffect(() => {
    if (!TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
      return;
    }
    const drainUiCounters = () => {
      const count = uiFrameCountSV.value;
      if (count > 0) {
        followProfiler.ingestUiFrameStats({
          count,
          sumMs: uiFrameSumSV.value,
          maxMs: uiFrameMaxSV.value,
          long20: uiLong20SV.value,
          long24: uiLong24SV.value,
          long32: uiLong32SV.value,
        });
        uiFrameCountSV.value = 0;
        uiFrameSumSV.value = 0;
        uiFrameMaxSV.value = 0;
        uiLong20SV.value = 0;
        uiLong24SV.value = 0;
        uiLong32SV.value = 0;
      }
      const exec = uiScrollExecSV.value;
      if (exec > 0) {
        followProfiler.ingestUiScrollStats(exec, 0);
        uiScrollExecSV.value = 0;
      }
    };

    const followLive = isTimelineActive && isPlaying;
    if (followLive) {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER && !followProfiler.isActive()) {
        followProfiler.startSession();
      }
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER && !getItemLayoutTracer.isActive()) {
        getItemLayoutTracer.startSession();
      }
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        profileActiveSV.value = 1;
      }
    } else {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER && followProfiler.isActive()) {
        profileActiveSV.value = 0;
        drainUiCounters();
        followProfiler.stopSessionAndPrint();
      }
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER && getItemLayoutTracer.isActive()) {
        getItemLayoutTracer.stopSessionAndPrint();
      }
    }
  }, [
    isTimelineActive,
    isPlaying,
    profileActiveSV,
    uiFrameCountSV,
    uiFrameSumSV,
    uiFrameMaxSV,
    uiLong20SV,
    uiLong24SV,
    uiLong32SV,
    uiScrollExecSV,
  ]);

  // DEV: drain UI SharedValue counters into the JS profiler (~2× per rolling window).
  useEffect(() => {
    if (!TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
      return;
    }
    const id = setInterval(() => {
      if (!followProfiler.isActive()) {
        return;
      }
      const count = uiFrameCountSV.value;
      if (count > 0) {
        followProfiler.ingestUiFrameStats({
          count,
          sumMs: uiFrameSumSV.value,
          maxMs: uiFrameMaxSV.value,
          long20: uiLong20SV.value,
          long24: uiLong24SV.value,
          long32: uiLong32SV.value,
        });
        uiFrameCountSV.value = 0;
        uiFrameSumSV.value = 0;
        uiFrameMaxSV.value = 0;
        uiLong20SV.value = 0;
        uiLong24SV.value = 0;
        uiLong32SV.value = 0;
      }
      const exec = uiScrollExecSV.value;
      if (exec > 0) {
        followProfiler.ingestUiScrollStats(exec, 0);
        uiScrollExecSV.value = 0;
      }
    }, 500);
    return () => clearInterval(id);
  }, [
    uiFrameCountSV,
    uiFrameSumSV,
    uiFrameMaxSV,
    uiLong20SV,
    uiLong24SV,
    uiLong32SV,
    uiScrollExecSV,
  ]);

  const onUiLongFrame = useCallback((deltaMs: number, timestampMs: number) => {
    followProfiler.noteUiLongFrame(deltaMs, timestampMs);
  }, []);

  useFrameCallback(
    (info) => {
      'worklet';
      if (profileActiveSV.value !== 1) {
        return;
      }
      const delta = info.timeSincePreviousFrame;
      if (delta == null) {
        return;
      }
      uiFrameCountSV.value += 1;
      uiFrameSumSV.value += delta;
      if (delta > uiFrameMaxSV.value) {
        uiFrameMaxSV.value = delta;
      }
      if (delta >= 20) {
        uiLong20SV.value += 1;
      }
      if (delta >= 24) {
        uiLong24SV.value += 1;
      }
      if (delta >= 32) {
        uiLong32SV.value += 1;
      }
      if (delta >= 20) {
        runOnJS(onUiLongFrame)(delta, info.timestamp);
      }
    },
    TEMP_ENABLE_FOLLOW_SCROLL_PROFILER,
  );

  // UI-thread apply path: SharedValue write (JS) → useAnimatedReaction → scrollTo (UI).
  // Only active while USE_UI_THREAD_FOLLOW_SCROLL is true; inactive when flag is false.
  useAnimatedReaction(
    () => followScrollX.value,
    (offset) => {
      'worklet';
      if (!USE_UI_THREAD_FOLLOW_SCROLL) {
        return;
      }
      if (profileActiveSV.value === 1) {
        uiScrollExecSV.value += 1;
      }
      if (useScrollViewFollowSV.value === 1) {
        scrollTo(scrollViewRef, offset, 0, false);
      } else {
        scrollTo(flatListRef, offset, 0, false);
      }
    },
  );

  const scrollContentToOffset = useCallback((offset: number, animated: boolean) => {
    if (useScrollViewFollowSV.value === 1) {
      const node = scrollViewRef.current;
      if (node != null && 'scrollTo' in node) {
        (node as { scrollTo: (args: { x: number; y: number; animated: boolean }) => void }).scrollTo({
          x: offset,
          y: 0,
          animated,
        });
      }
      return;
    }
    flatListRef.current?.scrollToOffset({ offset, animated });
  }, [flatListRef, scrollViewRef, useScrollViewFollowSV]);

  /**
   * Instant follow / hard-sync apply.
   * UI-thread path: write SharedValue only (reaction scrolls on UI).
   * JS fallback: imperative scroll on the active list container.
   * Animated scrolls (scrollToStart / edit focus / stop reset) never use this.
   */
  const applyInstantFollowOffset = useCallback(
    (offset: number) => {
      if (Date.now() < autoFollowSuspendedUntil.current) {
        return;
      }

      if (USE_UI_THREAD_FOLLOW_SCROLL) {
        if (__DEV__ && !uiFollowRefVerifiedRef.current) {
          uiFollowRefVerifiedRef.current = true;
          const attached =
            useScrollViewFollowSV.value === 1
              ? scrollViewRef.current != null
              : flatListRef.current != null;
          if (!attached) {
            console.warn(
              '[SongSignatureTimeline] UI-thread follow-scroll: animated ref is null when first applying follow offset.',
            );
          }
        }
        if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
          followProfiler.noteJsScrollRequest(offset);
        }
        if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER) {
          getItemLayoutTracer.noteScrollToRequest();
        }
        followScrollX.value = offset;
        return;
      }

      // Baseline fallback — only reached when USE_UI_THREAD_FOLLOW_SCROLL is false.
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        followProfiler.noteJsScrollRequest(offset);
      }
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER) {
        getItemLayoutTracer.noteScrollToRequest();
      }
      scrollContentToOffset(offset, false);
    },
    [followScrollX, scrollContentToOffset, useScrollViewFollowSV, scrollViewRef, flatListRef],
  );

  const scrollToPlaybackPosition = useCallback(
    (animated: boolean) => {
      const cursor = playbackCursorRef.current;
      const offset = playbackScrollOffset(
        segmentsRef.current,
        cursor.barIndex,
        cursor.beatPosition,
      );

      if (!animated) {
        applyInstantFollowOffset(offset);
        return;
      }

      if (Date.now() < autoFollowSuspendedUntil.current) {
        return;
      }
      scrollContentToOffset(offset, true);
    },
    [applyInstantFollowOffset, scrollContentToOffset],
  );

  const animateFollow = useCallback(
    (_timestamp: number) => {
      const cursor = playbackCursorRef.current;

      // Playback ended (manual Stop or natural completion) — tear down follow.
      if (!cursor.isPlaying) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        followProfiler.noteJsRaf();
      }

      advanceFollowCursor(cursor, segmentsRef.current, performance.now());

      if (!cursor.isPlaying) {
        animationFrameRef.current = null;
        return;
      }

      // Follow-cursor math unchanged. Apply path:
      // UI-thread (flag on) → SharedValue → Reanimated scrollTo worklet
      // JS fallback (flag off) → scrollToOffset inside applyInstantFollowOffset
      const offset = playbackScrollOffset(
        segmentsRef.current,
        cursor.barIndex,
        cursor.beatPosition,
      );
      applyInstantFollowOffset(offset);
      animationFrameRef.current = requestAnimationFrame(animateFollow);
    },
    [applyInstantFollowOffset],
  );

  useEffect(() => {
    const applyTransportFromStore = () => {
      const songPlayback = store.getState().songPlayback;
      const segmentsNow = segmentsRef.current;
      const isActive = isTimelineActiveRef.current;
      const playing = isPlayingRef.current;
      // Bar + beat must come from the same Redux snapshot (subscribe runs before
      // React updates currentBarIndexRef). Using the ref here falsely treated
      // every new-bar downbeat as loopRestartSync while the bar ref was still 0.
      const barIndex = songPlayback.currentBarIndex;
      const tick = songPlayback.debugTick;
      const followLive = isActive && playing;

      const meterFromTick =
        tick !== null
          ? `${tick.meterNumerator}/${tick.meterDenominator}`
          : null;
      const meterFromSegments =
        segmentsNow.find(
          (segment) =>
            barIndex >= segment.startBar - 1 && barIndex <= segment.endBar - 1,
        )?.meter ?? '4/4';
      const meter =
        meterFromTick !== null && meterFromTick.length > 0
          ? meterFromTick
          : meterFromSegments;

      const currentBeatIndex =
        followLive && tick !== null ? tick.beatIndexInBar : -1;
      const currentBpm = tick?.bpm ?? null;
      const tickKey = `${barIndex}:${currentBeatIndex}:${currentBpm ?? 'na'}:${meter}`;
      const tickChanged = tickKey !== lastTickKeyRef.current;
      const startingPlayback = isActive && playing && !wasPlayingRef.current;
      // Loop restart keeps isPlaying true — hard-sync when transport wraps to bar 1.
      const loopRestartSync =
        tickChanged &&
        isActive &&
        playing &&
        !startingPlayback &&
        barIndex === 0 &&
        Math.max(0, currentBeatIndex) === 0;
      const beatDurationMs = pulseDurationMs(currentBpm, meter);
      const audioBeat = Math.max(0, currentBeatIndex);
      const now = performance.now();

      wasPlayingRef.current = isActive && playing;

      if (startingPlayback || loopRestartSync) {
        lastTickKeyRef.current = tickKey;
        hardSyncFollowCursorToAudio(
          playbackCursorRef.current,
          segmentsNow,
          barIndex,
          audioBeat,
          beatDurationMs,
          now,
        );
        autoFollowSuspendedUntil.current = 0;
        scrollToPlaybackPosition(false);
      } else if (tickChanged) {
        lastTickKeyRef.current = tickKey;
        const cursor = playbackCursorRef.current;
        cursor.isPlaying = isActive && playing;
        // Audio tick updates the master-clock anchor only — no per-beat visual snap.
        applyAudioTickToFollowCursor(
          cursor,
          segmentsNow,
          barIndex,
          audioBeat,
          beatDurationMs,
          now,
        );
      } else {
        playbackCursorRef.current.isPlaying = isActive && playing;
        playbackCursorRef.current.beatDurationMs = beatDurationMs;
      }

      // Highlight stores — MeterRegions subscribe selectively; FlatList data stays stable.
      setSongLineBarIndex(followLive ? barIndex : -1);
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER) {
        getItemLayoutTracer.noteBarIndex(followLive ? barIndex : -1);
      }
      setSongLineBeatIndex(
        TEMP_DISABLE_SONG_LINE_BEAT_HIGHLIGHT
          ? -1
          : followLive
            ? currentBeatIndex
            : -1,
      );

      if (playbackCursorRef.current.isPlaying && animationFrameRef.current === null) {
        playbackCursorRef.current.lastFrameAt = performance.now();
        animationFrameRef.current = requestAnimationFrame(animateFollow);
      }

      if (!playbackCursorRef.current.isPlaying && animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    applyTransportFromStoreRef.current = applyTransportFromStore;
    const unsubscribe = store.subscribe(applyTransportFromStore);
    applyTransportFromStore();
    return unsubscribe;
  }, [animateFollow, scrollToPlaybackPosition]);

  // After React commits play/bar/segment props, re-run transport (store.listen may have
  // seen stale refs mid-dispatch). Does not run on beat ticks — those props are stable.
  useEffect(() => {
    applyTransportFromStoreRef.current();
  }, [isPlaying, isTimelineActive, currentBarIndex, segments]);

  useEffect(() => {
    const wasActive = wasTimelineActiveRef.current;
    wasTimelineActiveRef.current = isTimelineActive;

    if (wasActive && !isTimelineActive) {
      playbackCursorRef.current = createFollowCursor({
        lastFrameAt: performance.now(),
      });
      wasPlayingRef.current = false;
      lastTickKeyRef.current = null;
      setSongLineBarIndex(-1);
      setSongLineBeatIndex(-1);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      requestAnimationFrame(() => {
        scrollContentToOffset(0, true);
      });
    }
  }, [isTimelineActive, scrollContentToOffset]);

  useEffect(
    () => () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (scrollToStartTimeoutRef.current !== null) {
        clearTimeout(scrollToStartTimeoutRef.current);
        scrollToStartTimeoutRef.current = null;
      }
      scrollToStartResolveRef.current = null;
      scrollToStartPromiseRef.current = null;
    },
    [],
  );

  const finishScrollToStart = useCallback(() => {
    if (scrollToStartTimeoutRef.current !== null) {
      clearTimeout(scrollToStartTimeoutRef.current);
      scrollToStartTimeoutRef.current = null;
    }
    const resolve = scrollToStartResolveRef.current;
    scrollToStartResolveRef.current = null;
    scrollToStartPromiseRef.current = null;
    resolve?.();
  }, []);

  const onManualScroll = useCallback(() => {
    autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        followProfiler.noteFlatList('onScroll');
      }
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER) {
        getItemLayoutTracer.noteOnScroll();
      }
      const offset = event.nativeEvent.contentOffset.x;
      scrollOffsetRef.current = offset;
      if (
        scrollToStartResolveRef.current !== null &&
        offset <= SCROLL_START_EPSILON_PX
      ) {
        finishScrollToStart();
      }
    },
    [finishScrollToStart],
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      scrollOffsetRef.current = offset;
      if (
        scrollToStartResolveRef.current !== null &&
        offset <= SCROLL_START_EPSILON_PX
      ) {
        finishScrollToStart();
      }
    },
    [finishScrollToStart],
  );

  const handleScrollBeginDrag = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onManualScroll();
    },
    [onManualScroll],
  );

  const scrollToStart = useCallback((): Promise<void> => {
    if (scrollOffsetRef.current <= SCROLL_START_EPSILON_PX) {
      return Promise.resolve();
    }

    if (scrollToStartPromiseRef.current !== null) {
      return scrollToStartPromiseRef.current;
    }

    const promise = new Promise<void>((resolve) => {
      scrollToStartResolveRef.current = resolve;
      autoFollowSuspendedUntil.current = 0;
      scrollContentToOffset(0, true);

      scrollToStartTimeoutRef.current = setTimeout(() => {
        scrollOffsetRef.current = 0;
        finishScrollToStart();
      }, SCROLL_TO_START_TIMEOUT_MS);
    });
    scrollToStartPromiseRef.current = promise;
    return promise;
  }, [finishScrollToStart, scrollContentToOffset]);

  const openSegmentEditor = useCallback(
    (segment: TimelineSegmentViewModel, tempoFocus: TempoEditFocus = null) => {
      selectedSegmentIdRef.current = segment.id;
      autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
      const targetOffset = playbackScrollOffset(segments, segment.startBar - 1, 0);
      scrollContentToOffset(targetOffset, true);
      setFocusSegmentId(segment.id);
      setFocusTempoEdit(tempoFocus);
      setSegmentEditorVisible(true);
    },
    [segments, scrollContentToOffset],
  );

  const scrollToNavigatorSection = useCallback(
    (navigatorSectionIndex: number) => {
      const globalBarIndex = firstGlobalBarIndexForNavigatorSectionIndex(
        song.sections,
        navigatorSectionIndex,
      );
      if (globalBarIndex === null) {
        return;
      }

      const targetOffset = clampCenteredBarScrollOffset(segments, globalBarIndex, viewportWidth);
      if (targetOffset === null) {
        return;
      }

      autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
      scrollContentToOffset(targetOffset, true);
    },
    [scrollContentToOffset, segments, song.sections, viewportWidth],
  );

  useImperativeHandle(
    ref,
    () => ({
      openEditSegment: () => {
        if (segments.length === 0) {
          return;
        }
        const selected =
          segments.find((segment) => segment.id === selectedSegmentIdRef.current) ??
          segments.find((segment) => segment.isActive) ??
          segments[0];
        openSegmentEditor(selected);
      },
      scrollToStart,
      scrollToNavigatorSection,
    }),
    [segments, openSegmentEditor, scrollToNavigatorSection, scrollToStart],
  );

  const openSongTempoEditor = useCallback(() => {
    autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
    setFocusSegmentId(null);
    setFocusTempoEdit('song');
    setSegmentEditorVisible(true);
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<TimelineSegmentViewModel> | null | undefined, index: number) => {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        followProfiler.noteFlatList('itemLayout');
      }
      if (TEMP_ENABLE_GET_ITEM_LAYOUT_TRACER) {
        getItemLayoutTracer.noteCall(index);
      }
      const segment = segments[index];
      const length = segment ? segmentStride(segment) : REGION_GAP;
      let offset = 0;
      for (let i = 0; i < index; i += 1) {
        offset += segmentStride(segments[i]);
      }
      return { length, offset, index };
    },
    [segments],
  );

  const onTimelineProfilerRender = useCallback<ProfilerOnRenderCallback>(
    (id, phase, actualDuration) => {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
        followProfiler.noteReactCommit(id, phase, actualDuration);
      }
    },
    [],
  );

  const onViewableItemsChanged = useCallback(
    ({ changed }: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => {
      if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER && changed.length > 0) {
        followProfiler.noteFlatList('viewableItemsChanged');
      }
    },
    [],
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 10 }),
    [],
  );

  /** Playback-only non-virtualized A/B — FlatList remains for idle/editing. */
  const nonVirtualizedPlayback =
    USE_NON_VIRTUALIZED_PLAYBACK_TIMELINE && isTimelineActive && isPlaying;

  // Keep worklet scroll target in sync before paint (FlatList unmounts this commit).
  useScrollViewFollowSV.value = nonVirtualizedPlayback ? 1 : 0;

  useEffect(() => {
    if (__DEV__ && USE_NON_VIRTUALIZED_PLAYBACK_TIMELINE && TEMP_ENABLE_PROFILER_CONSOLE_LOGS) {
      console.log(
        `[SongSignatureTimeline] non-virtualized playback A/B: ${
          nonVirtualizedPlayback ? 'ON (ScrollView)' : 'OFF (FlatList)'
        }`,
      );
    }
    if (nonVirtualizedPlayback) {
      // Preserve offset across FlatList → ScrollView remount at play start.
      const offset = scrollOffsetRef.current;
      requestAnimationFrame(() => {
        scrollContentToOffset(offset, false);
      });
    }
  }, [nonVirtualizedPlayback, scrollContentToOffset]);

  const contentPaddingStyle = useMemo(
    () => ({
      paddingLeft: viewportWidth / 2,
      paddingRight: viewportWidth / 2,
    }),
    [viewportWidth],
  );

  const renderTimelineRegion = (item: TimelineSegmentViewModel, index: number) => {
    const tempoBpm = tempoMarkings[index] ?? null;
    const regionTempoBpm = effectiveSegmentBpm(item.bpmOverride, song.defaultBpm);
    const previousMeter = index > 0 ? segments[index - 1]?.meter : null;
    const showTimeSignature = index === 0 || previousMeter !== item.meter;
    return (
      <View style={styles.item}>
        <MeterRegion
          segment={item}
          overviewTempoBpm={tempoBpm}
          regionTempoBpm={regionTempoBpm}
          showTimeSignature={showTimeSignature}
          songLoopEnabled={songLoopEnabled}
          onPress={() => openSegmentEditor(item)}
          onPlayFromHere={
            showTimeSignature
              ? () => {
                  onPlayFromSegment(item);
                }
              : undefined
          }
          onTempoPress={
            tempoBpm === null
              ? undefined
              : () => {
                  if (index === 0) {
                    openSongTempoEditor();
                    return;
                  }
                  openSegmentEditor(item, 'segment');
                }
          }
          isPlaying={isTimelineActive && isPlaying}
        />
      </View>
    );
  };

  const addBarControl = (
    <View style={styles.addBarRegion}>
      {/* Matches MeterRegion header so the control sits in the pulse track band. */}
      <View
        style={[styles.addBarHeaderSpacer, songLoopEnabled && styles.loopLaneHighlight]}
      />
      <View style={styles.addBarTrack}>
        <Pressable
          style={styles.addBarButton}
          onPress={() => setNewBarDialogVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add bar"
        >
          <Text style={styles.addBarButtonText}>+ Add Bar</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Profiler id="SongSignatureTimeline" onRender={onTimelineProfilerRender}>
      <View style={styles.wrapper}>
        <View
          style={styles.listContainer}
          onLayout={(event) => {
            if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
              followProfiler.noteFlatList('onLayout');
            }
            setViewportWidth(event.nativeEvent.layout.width);
          }}
        >
          {nonVirtualizedPlayback ? (
            <Animated.ScrollView
              ref={scrollViewRef}
              style={styles.list}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              onScrollBeginDrag={handleScrollBeginDrag}
              scrollEventThrottle={16}
              contentContainerStyle={[styles.content, contentPaddingStyle]}
            >
              {segments.length === 0 ? (
                <View style={styles.emptyInline}>
                  <Text style={styles.empty}>No meter regions yet.</Text>
                </View>
              ) : (
                segments.map((item, index) => (
                  <Fragment key={`${item.id}-${item.meter}-${item.numberOfBars}`}>
                    {renderTimelineRegion(item, index)}
                  </Fragment>
                ))
              )}
              {addBarControl}
            </Animated.ScrollView>
          ) : (
            <FlatList
              ref={flatListRef}
              style={styles.list}
              horizontal
              data={segments as TimelineSegmentViewModel[]}
              keyExtractor={(item) => `${item.id}-${item.meter}-${item.numberOfBars}`}
              renderItem={({ item, index }) => renderTimelineRegion(item, index)}
              ListEmptyComponent={
                <View style={styles.emptyInline}>
                  <Text style={styles.empty}>No meter regions yet.</Text>
                </View>
              }
              ListFooterComponent={addBarControl}
              getItemLayout={getItemLayout}
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumScrollEnd}
              onScrollBeginDrag={handleScrollBeginDrag}
              onContentSizeChange={() => {
                if (TEMP_ENABLE_FOLLOW_SCROLL_PROFILER) {
                  followProfiler.noteFlatList('contentSizeChange');
                }
              }}
              onViewableItemsChanged={
                TEMP_ENABLE_FOLLOW_SCROLL_PROFILER ? onViewableItemsChanged : undefined
              }
              viewabilityConfig={
                TEMP_ENABLE_FOLLOW_SCROLL_PROFILER ? viewabilityConfig : undefined
              }
              scrollEventThrottle={16}
              contentContainerStyle={[styles.content, contentPaddingStyle]}
              extraData={`${isPlaying}-${isTimelineActive}-${song.defaultBpm}-${tempoMarkings.join(',')}-${songLoopEnabled}`}
              windowSize={5}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
            />
          )}
          {viewportWidth > 0 ? (
            <View
              pointerEvents="none"
              style={[styles.playhead, { left: viewportWidth / 2 }]}
            >
              <View style={styles.playheadCap} />
            </View>
          ) : null}
        </View>

        <SegmentEditBottomSheet
          visible={segmentEditorVisible}
          segments={segments}
          songName={song.name}
          songDefaultBpm={song.defaultBpm}
          countInBars={song.countInBars}
          focusSegmentId={focusSegmentId}
          focusTempoEdit={focusTempoEdit}
          onClose={() => {
            setSegmentEditorVisible(false);
            setFocusSegmentId(null);
            setFocusTempoEdit(null);
          }}
          onSongDefaultBpmChange={onSongDefaultBpmChange}
          onCountInBarsChange={onCountInBarsChange}
          onBarCountChange={(segmentId, count) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onSegmentBarCountChange(domain, count);
            }
          }}
          onMeterChange={(segmentId, meter) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onSegmentMeterChange(domain, meter);
            }
          }}
          onBpmOverrideChange={(segmentId, bpm) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onSegmentBpmOverrideChange(domain, bpm);
            }
          }}
          onAccentPatternChange={(segmentId, pattern) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onSegmentAccentPatternChange(domain, pattern);
            }
          }}
          onDuplicateSegment={(segmentId) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain === null) {
              return null;
            }
            const focusSegmentIdAfter = `seg-${domain.endBarIndex + 1}`;
            onSegmentDuplicate(domain);
            return focusSegmentIdAfter;
          }}
          onDeleteSegment={(segmentId) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain === null) {
              return null;
            }
            return onSegmentDelete(domain);
          }}
          onCreateSection={(segmentId, name) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onCreateSection(domain, name);
            }
          }}
          onRemoveSection={(segmentId) => {
            const domain = findDomainSegmentById(song, segmentId);
            if (domain !== null) {
              onRemoveSection(domain);
            }
          }}
        />
        <NewBarMeterDialog
          visible={newBarDialogVisible}
          onCancel={() => setNewBarDialogVisible(false)}
          onConfirm={(meter) => {
            setNewBarDialogVisible(false);
            onAddBar(meter);
          }}
        />
      </View>
    </Profiler>
  );
  }),
);

SongSignatureTimeline.displayName = 'SongSignatureTimeline';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minHeight: 200,
  },
  listContainer: {
    flex: 1,
    minHeight: 160,
    overflow: 'hidden',
  },
  list: {
    flex: 1,
  },
  content: {
    alignItems: 'stretch',
    paddingVertical: 4,
    flexGrow: 1,
  },
  item: {
    alignSelf: 'stretch',
    marginRight: REGION_GAP,
  },
  playhead: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    width: 2,
    marginLeft: -1,
    backgroundColor: studioColors.beatAccent,
    shadowColor: studioColors.beatAccent,
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 5,
  },
  playheadCap: {
    position: 'absolute',
    top: 0,
    left: -4,
    width: 10,
    height: 5,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: studioColors.beatAccent,
  },
  emptyInline: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  empty: {
    color: studioColors.textSecondary,
    textAlign: 'left',
    fontSize: 14,
  },
  addBarRegion: {
    alignSelf: 'stretch',
    height: '100%',
    paddingTop: 2,
    paddingBottom: 8,
    paddingLeft: 28,
    paddingRight: 8,
  },
  addBarHeaderSpacer: {
    height: 44,
  },
  loopLaneHighlight: {
    backgroundColor: 'rgba(59, 158, 255, 0.1)',
  },
  addBarTrack: {
    flex: 1,
    minHeight: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  addBarButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: studioColors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: studioColors.surface,
    // Nudge down so the control's visual center matches the pulse glyphs.
    transform: [{ translateY: BAR_CELL_PADDING_V }],
  },
  addBarButtonText: {
    fontWeight: '600',
    color: studioColors.textSecondary,
    fontSize: 13,
  },
});
