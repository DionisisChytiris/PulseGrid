import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

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
import { setSongLineBeatIndex } from './SongLineBeatContext';
import {
  advanceFollowCursor,
  createFollowCursor,
  followScrollBeatPosition,
  hardSyncFollowCursorToAudio,
  applyAudioTickToFollowCursor,
  type FollowCursorState,
} from './songLineFollowCursor';
import {
  BAR_CELL_PADDING_V,
  REGION_GAP,
  TRACK_HEIGHT,
  barCellWidth,
  meterRegionWidth,
  parseMeterDenominator,
} from './signatureTimelineConstants';

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

function segmentStride(segment: TimelineSegmentViewModel): number {
  const denominator = parseMeterDenominator(segment.meter);
  return (
    meterRegionWidth(segment.numberOfBars, segment.accentPreview.length, denominator) +
    REGION_GAP
  );
}

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
      onSongDefaultBpmChange,
      onCountInBarsChange,
      onPlayFromSegment,
      onAddBar,
      songLoopEnabled = false,
    },
    ref,
  ) {
  const listRef = useRef<FlatList<TimelineSegmentViewModel>>(null);
  const autoFollowSuspendedUntil = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
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

  const scrollToPlaybackPosition = useCallback((animated: boolean) => {
    const cursor = playbackCursorRef.current;
    const offset = playbackScrollOffset(
      segmentsRef.current,
      cursor.barIndex,
      cursor.beatPosition,
    );

    if (Date.now() >= autoFollowSuspendedUntil.current) {
      listRef.current?.scrollToOffset({ offset, animated });
    }
  }, []);

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

      advanceFollowCursor(cursor, segmentsRef.current, performance.now());

      if (!cursor.isPlaying) {
        animationFrameRef.current = null;
        return;
      }

      scrollToPlaybackPosition(false);
      animationFrameRef.current = requestAnimationFrame(animateFollow);
    },
    [scrollToPlaybackPosition],
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

      // LED beat store — only active MeterRegion subscribes; host does not re-render.
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

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  }, [isTimelineActive]);

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
      listRef.current?.scrollToOffset({ offset: 0, animated: true });

      scrollToStartTimeoutRef.current = setTimeout(() => {
        scrollOffsetRef.current = 0;
        finishScrollToStart();
      }, SCROLL_TO_START_TIMEOUT_MS);
    });
    scrollToStartPromiseRef.current = promise;
    return promise;
  }, [finishScrollToStart]);

  const openSegmentEditor = useCallback(
    (segment: TimelineSegmentViewModel, tempoFocus: TempoEditFocus = null) => {
      selectedSegmentIdRef.current = segment.id;
      autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
      const targetOffset = playbackScrollOffset(segments, segment.startBar - 1, 0);
      listRef.current?.scrollToOffset({ offset: targetOffset, animated: true });
      setFocusSegmentId(segment.id);
      setFocusTempoEdit(tempoFocus);
      setSegmentEditorVisible(true);
    },
    [segments],
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
    }),
    [segments, openSegmentEditor, scrollToStart],
  );

  const openSongTempoEditor = useCallback(() => {
    autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
    setFocusSegmentId(null);
    setFocusTempoEdit('song');
    setSegmentEditorVisible(true);
  }, []);

  const getItemLayout = useCallback(
    (_data: ArrayLike<TimelineSegmentViewModel> | null | undefined, index: number) => {
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
      <View style={styles.wrapper}>
        <View
          style={styles.listContainer}
          onLayout={(event) => {
            setViewportWidth(event.nativeEvent.layout.width);
          }}
        >
          <FlatList
            ref={listRef}
            style={styles.list}
            horizontal
            data={segments as TimelineSegmentViewModel[]}
            keyExtractor={(item) => `${item.id}-${item.meter}-${item.numberOfBars}`}
            renderItem={({ item, index }) => {
              const tempoBpm = tempoMarkings[index] ?? null;
              const regionTempoBpm = effectiveSegmentBpm(
                item.bpmOverride,
                song.defaultBpm,
              );
              const previousMeter = index > 0 ? segments[index - 1]?.meter : null;
              const showTimeSignature =
                index === 0 || previousMeter !== item.meter;
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
            }}
            ListEmptyComponent={
              <View style={styles.emptyInline}>
                <Text style={styles.empty}>No meter regions yet.</Text>
              </View>
            }
            ListFooterComponent={addBarControl}
            getItemLayout={getItemLayout}
            showsHorizontalScrollIndicator
            decelerationRate="fast"
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            onScrollBeginDrag={handleScrollBeginDrag}
            scrollEventThrottle={16}
            contentContainerStyle={[
              styles.content,
              {
                paddingLeft: viewportWidth / 2,
                paddingRight: viewportWidth / 2,
              },
            ]}
            extraData={`${currentBarIndex}-${isPlaying}-${isTimelineActive}-${song.defaultBpm}-${tempoMarkings.join(',')}-${songLoopEnabled}`}
            windowSize={5}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
          />
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
