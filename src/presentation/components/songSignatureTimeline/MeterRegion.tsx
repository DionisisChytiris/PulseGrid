import { memo, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { BarPreview } from './BarPreview';
import { useSongLineBeatIndex } from './SongLineBeatContext';
import {
  TRACK_HEIGHT,
  meterRegionWidth,
  parseMeterDenominator,
} from './signatureTimelineConstants';
import { getSongLineRegionColors } from './tempoMarkingColor';

const PLAY_HINT_VISIBLE_MS = 700;
const PLAY_HINT_FADE_MS = 300;
const METER_HIT_SIZE = 44;

type Props = {
  segment: TimelineSegmentViewModel;
  /** Effective BPM shown inside the first bar when tempo changes; null when unchanged. */
  overviewTempoBpm?: number | null;
  /** Effective BPM for this region — drives accent-dot colour even when the marking is hidden. */
  regionTempoBpm: number;
  /**
   * Notation rule: show meter only on the first bar of a consecutive meter run
   * (song start or meter change). Same-meter duplicate segments stay silent.
   */
  showTimeSignature?: boolean;
  /** Subtle full-lane highlight while entire-song loop is enabled. */
  songLoopEnabled?: boolean;
  /** Opens Edit Segment (timeline / bar area). */
  onPress?: (segmentId: string) => void;
  /** Starts playback from this segment (time signature label). */
  onPlayFromHere?: (segmentId: string) => void;
  onTempoPress?: () => void;
  onLayout?: (segmentId: string, x: number, width: number) => void;
  /** Song playback running — pulse LEDs follow the playhead beat. */
  isPlaying?: boolean;
};

/**
 * Cubase-style Signature Track region:
 *
 *        4/4                 5/8          ← meter tap = play from here
 * ┌──────────────┐     ┌────────────┐
 * │ ♩ = 120      │     │ ♩ = 140    │   ← tempo in first bar (change only)
 * │ ● ○ ○ ○      │     │ ● ○ ○ ○ ○  │   ← track tap = edit segment
 * └──────────────┘     └────────────┘
 */
export const MeterRegion = memo(
  function MeterRegion({
    segment,
    overviewTempoBpm = null,
    regionTempoBpm,
    showTimeSignature = true,
    songLoopEnabled = false,
    onPress,
    onPlayFromHere,
    onTempoPress,
    onLayout,
    isPlaying = false,
  }: Props) {
    const regionPlaying = isPlaying && segment.isActive;
    // Only the active playing region subscribes — inactive ones skip beat re-renders.
    const currentBeatIndex = useSongLineBeatIndex(regionPlaying);
    const beatCount = Math.max(1, segment.accentPreview.length);
    const denominator = parseMeterDenominator(segment.meter);
    const width = meterRegionWidth(segment.numberOfBars, beatCount, denominator);
    const regionColors = getSongLineRegionColors(regionTempoBpm);
    const playHintOpacity = useRef(new Animated.Value(0)).current;
    const playHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const playHintAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    useEffect(
      () => () => {
        if (playHintTimeoutRef.current !== null) {
          clearTimeout(playHintTimeoutRef.current);
        }
        playHintAnimRef.current?.stop();
      },
      [],
    );

    const handlePlayFromHere = () => {
      if (onPlayFromHere === undefined) {
        return;
      }
      onPlayFromHere(segment.id);

      playHintAnimRef.current?.stop();
      if (playHintTimeoutRef.current !== null) {
        clearTimeout(playHintTimeoutRef.current);
      }
      playHintOpacity.setValue(1);
      playHintTimeoutRef.current = setTimeout(() => {
        playHintTimeoutRef.current = null;
        playHintAnimRef.current = Animated.timing(playHintOpacity, {
          toValue: 0,
          duration: PLAY_HINT_FADE_MS,
          useNativeDriver: true,
        });
        playHintAnimRef.current.start();
      }, PLAY_HINT_VISIBLE_MS);
    };

    return (
      <View
        style={[styles.region, { width }, segment.isActive && styles.regionActive]}
        onLayout={(event) => {
          const { x, width: layoutWidth } = event.nativeEvent.layout;
          onLayout?.(segment.id, x, layoutWidth);
        }}
      >
        <View style={[styles.header, songLoopEnabled && styles.headerLoopActive]}>
          {showTimeSignature ? (
            <Pressable
              onPress={handlePlayFromHere}
              disabled={onPlayFromHere === undefined}
              accessibilityRole="button"
              accessibilityLabel={`Play from ${segment.meter}`}
              hitSlop={4}
              style={({ pressed }) => [
                styles.meterHitTarget,
                pressed && onPlayFromHere !== undefined && styles.meterHitPressed,
              ]}
            >
              <Animated.Text style={[styles.playHint, { opacity: playHintOpacity }]}>
                ▶
              </Animated.Text>
              <Text
                style={[styles.meter, { color: regionColors.timeSignatureColour }]}
                numberOfLines={1}
              >
                {segment.meter}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={() => onPress?.(segment.id)}
          disabled={onPress === undefined}
          accessibilityRole="button"
          accessibilityLabel={`Edit segment ${segment.meter}`}
          style={[styles.track, segment.isActive && styles.trackActive]}
        >
          {segment.barIndicators.map((indicator, barIndex) => (
            <BarPreview
              key={`bar-${indicator.barNumber}`}
              beats={segment.accentPreview}
              denominator={denominator}
              isActive={indicator.isActive}
              isPast={indicator.isPast}
              isPlaying={regionPlaying}
              currentBeatIndex={currentBeatIndex}
              tempoBpm={barIndex === 0 ? overviewTempoBpm : null}
              onTempoPress={
                barIndex === 0 && overviewTempoBpm !== null ? onTempoPress : undefined
              }
              accentColor={regionColors.accentDotColour}
            />
          ))}
        </Pressable>
      </View>
    );
  },
  // Ignore callback identity — parent arrows change every beat render and would
  // defeat memo, forcing every region to reconcile and stall follow rAF.
  (prev, next) =>
    prev.segment === next.segment &&
    prev.overviewTempoBpm === next.overviewTempoBpm &&
    prev.regionTempoBpm === next.regionTempoBpm &&
    prev.showTimeSignature === next.showTimeSignature &&
    prev.songLoopEnabled === next.songLoopEnabled &&
    prev.isPlaying === next.isPlaying,
);

const styles = StyleSheet.create({
  region: {
    height: '100%',
    paddingTop: 2,
    paddingBottom: 8,
  },
  regionActive: {
    // Region chrome emphasizes active meter without shrinking content.
  },
  header: {
    height: METER_HIT_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 0,
  },
  /** ~10% accent — continuous across regions; does not tint meter/tempo text. */
  headerLoopActive: {
    backgroundColor: 'rgba(59, 158, 255, 0.1)',
  },
  meterHitTarget: {
    minWidth: METER_HIT_SIZE,
    minHeight: METER_HIT_SIZE,
    paddingLeft: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  meterHitPressed: {
    opacity: 0.7,
  },
  playHint: {
    position: 'absolute',
    left: -2,
    fontSize: 12,
    fontWeight: '700',
    color: studioColors.beatAccent,
  },
  meter: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  track: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: TRACK_HEIGHT,
    backgroundColor: studioColors.surface,
    // Visible so section-start pulse markers are not clipped to half-circles.
    overflow: 'visible',
  },
  trackActive: {
    backgroundColor: studioColors.surfaceElevated,
    shadowColor: studioColors.accent,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
