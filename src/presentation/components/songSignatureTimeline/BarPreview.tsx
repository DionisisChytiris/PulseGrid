import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AccentPreviewBeat } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';

import { BeatAccentIndicator } from './BeatAccentIndicator';
import { InlineTempoMarking } from './InlineTempoMarking';
import { profileRender } from './songLineFollowProfiler';
import {
  BAR_CELL_PADDING_V,
  GRID_SLOT_WIDTH,
  TRACK_HEIGHT,
  barCellWidth,
  pulseMarkerCenterX,
  pulseMarkerSize,
} from './signatureTimelineConstants';

type Props = {
  beats: readonly AccentPreviewBeat[];
  /** Time-signature denominator — drives pulse density on the fixed grid. */
  denominator: number;
  isActive?: boolean;
  isPast?: boolean;
  /** Song playback running — drives LED resting/current appearance. */
  isPlaying?: boolean;
  /** 0-based beat in the active bar (ignored when this bar is not active). */
  currentBeatIndex?: number;
  /** Tempo change marking — shown in the unused top space of this bar only. */
  tempoBpm?: number | null;
  /** Section name — shown in the unused lower-left space of the section's first bar. */
  sectionName?: string | null;
  onTempoPress?: () => void;
  /** Idle accent-dot colour for this tempo region (from getTempoMarkingColor). */
  accentColor?: string;
};

/**
 * One bar cell inside a Signature Track region.
 *
 * Grid lines follow a fixed quarter-note ruler.
 * The first pulse of each quarter-note group sits on the grid line;
 * remaining subdivision pulses are evenly spaced toward the next grid line.
 *
 * Bar-start / section-start pulses (index 0) are kept fully inside the cell so
 * parent overflow never clips them into half-circles at signature boundaries.
 */
export const BarPreview = memo(function BarPreview({
  beats,
  denominator,
  isActive = false,
  isPast = false,
  isPlaying = false,
  currentBeatIndex = -1,
  tempoBpm = null,
  sectionName = null,
  onTempoPress,
  accentColor,
}: Props) {
  profileRender('BarPreview');
  const pulseCount = Math.max(1, beats.length);
  const width = barCellWidth(pulseCount, denominator);
  const markerSize = pulseMarkerSize(denominator);
  const barPlaying = isPlaying && isActive;

  const gridLineOffsets = useMemo(() => {
    const offsets: number[] = [];
    // Skip 0 — the cell's left border is the bar / first grid line.
    for (let x = GRID_SLOT_WIDTH; x < width - 0.5; x += GRID_SLOT_WIDTH) {
      offsets.push(x);
    }
    return offsets;
  }, [width]);

  return (
    <View
      style={[
        styles.cell,
        { width, minHeight: TRACK_HEIGHT },
        isPast && styles.past,
        isActive && styles.active,
      ]}
    >
      <View pointerEvents="none" style={styles.grid}>
        {gridLineOffsets.map((x) => (
          <View key={`grid-${x}`} style={[styles.gridLine, { left: x }]} />
        ))}
      </View>

      {tempoBpm !== null ? (
        <Pressable
          style={styles.tempoSlot}
          onPress={onTempoPress}
          disabled={onTempoPress === undefined}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Tempo ${tempoBpm} BPM`}
        >
          <InlineTempoMarking bpm={tempoBpm} />
        </Pressable>
      ) : null}

      <View pointerEvents="none" style={styles.pulseLayer}>
        {beats.map((beat, index) => {
          const centerX = pulseMarkerCenterX(index, denominator);
          // Position by centre, so anchor pulses use the exact grid-line x-coordinate.
          const left = centerX - markerSize / 2;

          return (
            <View
              key={`pulse-${index}`}
              style={[
                styles.pulseSlot,
                {
                  left,
                  width: markerSize,
                  height: markerSize,
                },
              ]}
            >
              <BeatAccentIndicator
                accented={beat.symbol === 'accent'}
                size={markerSize}
                isPlaying={barPlaying}
                isCurrentBeat={barPlaying && index === currentBeatIndex}
                accentColor={accentColor}
              />
            </View>
          );
        })}
      </View>

      {sectionName !== null && sectionName.length > 0 ? (
        <Text
          pointerEvents="none"
          style={styles.sectionName}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {sectionName}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  cell: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingVertical: BAR_CELL_PADDING_V,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(148, 163, 184, 0.42)',
    overflow: 'visible',
    position: 'relative',
  },
  past: {
    backgroundColor: 'rgba(59, 158, 255, 0.1)',
  },
  active: {
    backgroundColor: studioColors.accentMutedBg,
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    marginLeft: -StyleSheet.hairlineWidth / 2,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
  },
  /** Tempo sits in unused space above the beat dots; pulse positions unchanged. */
  tempoSlot: {
    position: 'absolute',
    top: 3,
    left: 5,
    right: 2,
    zIndex: 2,
  },
  /** Section name sits in unused space below the beat dots; bar geometry unchanged. */
  sectionName: {
    position: 'absolute',
    bottom: 3,
    left: 5,
    right: 2,
    zIndex: 2,
    fontSize: 11,
    fontWeight: '700',
    color: studioColors.textMuted,
    letterSpacing: 0.2,
  },
  pulseLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 1,
  },
  pulseSlot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
