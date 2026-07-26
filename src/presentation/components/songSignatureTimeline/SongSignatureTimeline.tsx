import {
  forwardRef,
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
import type { Song } from '../../../domain/music/Song';
import { pulseDurationMsFromDisplayBpm } from '../../../domain/metronome/PulseGridSettings';
import { findDomainSegmentById } from '../../viewModels/buildTimelineSegmentViewModels';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { MeterRegion } from './MeterRegion';
import { NewBarMeterDialog } from './NewBarMeterDialog';
import { overviewTempoMarkings, effectiveSegmentBpm } from './overviewTempoMarkings';
import { SongLineBeatContext } from './SongLineBeatContext';
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
  currentBeatIndex: number;
  currentBpm: number | null;
  currentMeter: string;
  onSegmentBarCountChange: (segment: TimelineSegment, count: number) => void;
  onSegmentMeterChange: (segment: TimelineSegment, meterLabel: string) => void;
  onSegmentBpmOverrideChange: (segment: TimelineSegment, bpm: number | null) => void;
  onSegmentAccentPatternChange: (segment: TimelineSegment, pattern: boolean[]) => void;
  onSegmentDuplicate: (segment: TimelineSegment) => void;
  onSegmentDelete: (segment: TimelineSegment) => string | null;
  onSongDefaultBpmChange: (bpm: number) => void;
  onPlayFromSegment: (segment: TimelineSegmentViewModel) => void;
  onAddBar: (meter: Meter) => void;
};

/** Imperative API for toolbar actions (e.g. Edit button). */
export type SongSignatureTimelineHandle = {
  openEditSegment: () => void;
};

type TempoEditFocus = 'song' | 'segment' | null;

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
 */
export const SongSignatureTimeline = forwardRef<SongSignatureTimelineHandle, Props>(
  function SongSignatureTimeline(
    {
      song,
      segments,
      isTimelineActive,
      isPlaying,
      currentBarIndex,
      currentBeatIndex,
      currentBpm,
      currentMeter,
      onSegmentBarCountChange,
      onSegmentMeterChange,
      onSegmentBpmOverrideChange,
      onSegmentAccentPatternChange,
      onSegmentDuplicate,
      onSegmentDelete,
      onSongDefaultBpmChange,
      onPlayFromSegment,
      onAddBar,
    },
    ref,
  ) {
  const listRef = useRef<FlatList<TimelineSegmentViewModel>>(null);
  const autoFollowSuspendedUntil = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  /** Last segment opened via tap / Edit — survives sheet close. */
  const selectedSegmentIdRef = useRef<string | null>(null);
  const playbackCursorRef = useRef<FollowCursorState>(createFollowCursor());
  const segmentsRef = useRef(segments);
  const wasTimelineActiveRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const lastTickKeyRef = useRef<string | null>(null);
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
    const meter =
      currentMeter !== '—' && currentMeter.length > 0
        ? currentMeter
        : (segments.find(
            (segment) =>
              currentBarIndex >= segment.startBar - 1 &&
              currentBarIndex <= segment.endBar - 1,
          )?.meter ?? '4/4');

    const tickKey = `${currentBarIndex}:${currentBeatIndex}:${currentBpm ?? 'na'}:${meter}`;
    const tickChanged = tickKey !== lastTickKeyRef.current;
    const startingPlayback = isTimelineActive && isPlaying && !wasPlayingRef.current;
    const beatDurationMs = pulseDurationMs(currentBpm, meter);
    const audioBeat = Math.max(0, currentBeatIndex);
    const now = performance.now();

    wasPlayingRef.current = isTimelineActive && isPlaying;

    if (startingPlayback) {
      lastTickKeyRef.current = tickKey;
      hardSyncFollowCursorToAudio(
        playbackCursorRef.current,
        segments,
        currentBarIndex,
        audioBeat,
        beatDurationMs,
        now,
      );
      autoFollowSuspendedUntil.current = 0;
      scrollToPlaybackPosition(false);
    } else if (tickChanged) {
      lastTickKeyRef.current = tickKey;
      const cursor = playbackCursorRef.current;
      cursor.isPlaying = isTimelineActive && isPlaying;
      // Audio tick updates the master-clock anchor only — no per-beat visual snap.
      applyAudioTickToFollowCursor(
        cursor,
        segments,
        currentBarIndex,
        audioBeat,
        beatDurationMs,
        now,
      );
    } else {
      playbackCursorRef.current.isPlaying = isTimelineActive && isPlaying;
      playbackCursorRef.current.beatDurationMs = beatDurationMs;
    }

    if (playbackCursorRef.current.isPlaying && animationFrameRef.current === null) {
      playbackCursorRef.current.lastFrameAt = performance.now();
      animationFrameRef.current = requestAnimationFrame(animateFollow);
    }

    if (!playbackCursorRef.current.isPlaying && animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [
    animateFollow,
    currentBarIndex,
    currentBeatIndex,
    currentBpm,
    currentMeter,
    isPlaying,
    isTimelineActive,
    scrollToPlaybackPosition,
    segments,
  ]);

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
    },
    [],
  );

  const onManualScroll = useCallback(() => {
    autoFollowSuspendedUntil.current = Date.now() + AUTO_FOLLOW_SUSPEND_MS;
  }, []);

  const handleScrollBeginDrag = useCallback(
    (_event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onManualScroll();
    },
    [onManualScroll],
  );

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
    }),
    [segments, openSegmentEditor],
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
      <View style={styles.addBarHeaderSpacer} />
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
    <SongLineBeatContext.Provider value={currentBeatIndex}>
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
            onScrollBeginDrag={handleScrollBeginDrag}
            contentContainerStyle={[
              styles.content,
              {
                paddingLeft: viewportWidth / 2,
                paddingRight: viewportWidth / 2,
              },
            ]}
            extraData={`${currentBarIndex}-${isPlaying}-${isTimelineActive}-${song.defaultBpm}-${tempoMarkings.join(',')}`}
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
          focusSegmentId={focusSegmentId}
          focusTempoEdit={focusTempoEdit}
          onClose={() => {
            setSegmentEditorVisible(false);
            setFocusSegmentId(null);
            setFocusTempoEdit(null);
          }}
          onSongDefaultBpmChange={onSongDefaultBpmChange}
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
    </SongLineBeatContext.Provider>
  );
});

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
