import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';

import { AccentBeatPreview } from './AccentBeatPreview';
import { studioColors } from '../../presentation/theme';
import { TIMELINE_SEGMENT_WIDTH } from './timelineConstants';

type Props = {
  segment: TimelineSegmentViewModel;
  onPress: (segmentId: string) => void;
  onLayout: (segmentId: string, x: number, width: number) => void;
};

export const TimelineSegmentRow = memo(
  function TimelineSegmentRow({ segment, onPress, onLayout }: Props) {
    const rangeLabel =
      segment.startBar === segment.endBar
        ? `Bar ${segment.startBar}`
        : `Bars ${segment.startBar}–${segment.endBar}`;

    return (
      <Pressable
        onPress={() => onPress(segment.id)}
        style={[styles.card, segment.isActive && styles.cardActive]}
        onLayout={(event) => {
          const { x, width } = event.nativeEvent.layout;
          onLayout(segment.id, x, width);
        }}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{segment.numberOfBars} bars</Text>
          <Text style={styles.meter}>{segment.meter}</Text>
        </View>

        <Text style={styles.range}>{rangeLabel}</Text>

        {segment.bpmOverride !== null ? (
          <View style={styles.bpmBadge}>
            <Text style={styles.bpmBadgeText}>{segment.bpmOverride} BPM</Text>
          </View>
        ) : null}

        <View style={styles.barRow}>
          {segment.barIndicators.map((indicator) => (
            <View
              key={`bar-${indicator.barNumber}`}
              style={[
                styles.barCircle,
                indicator.isPast && styles.barPast,
                indicator.isActive && styles.barActive,
              ]}
            >
              <Text
                style={[
                  styles.barLabel,
                  indicator.isActive && styles.barLabelActive,
                ]}
              >
                {indicator.label}
              </Text>
            </View>
          ))}
        </View>

        <AccentBeatPreview beats={segment.accentPreview} />
      </Pressable>
    );
  },
  (previous, next) => {
    if (previous.segment.id !== next.segment.id) return false;
    if (previous.segment.isActive !== next.segment.isActive) return false;
    if (previous.segment.activeBarIndex !== next.segment.activeBarIndex) return false;
    if (previous.segment.numberOfBars !== next.segment.numberOfBars) return false;
    if (previous.segment.meter !== next.segment.meter) return false;
    if (previous.segment.bpmOverride !== next.segment.bpmOverride) return false;

    const prevAccent = previous.segment.accentPreview;
    const nextAccent = next.segment.accentPreview;
    if (prevAccent.length !== nextAccent.length) return false;

    for (let index = 0; index < prevAccent.length; index += 1) {
      if (prevAccent[index]?.isAccented !== nextAccent[index]?.isAccented) {
        return false;
      }
    }

    return true;
  },
);

const styles = StyleSheet.create({
  card: {
    width: TIMELINE_SEGMENT_WIDTH,
    marginRight: 12,
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: studioColors.surface,
  },
  cardActive: {
    borderColor: studioColors.accent,
    borderWidth: 2,
    backgroundColor: studioColors.accentMutedBg,
    shadowColor: studioColors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontSize: 15, fontWeight: '700', color: studioColors.textPrimary },
  meter: { fontSize: 20, fontWeight: '800', color: studioColors.textPrimary },
  range: { marginTop: 4, fontSize: 12, color: studioColors.textSecondary, fontWeight: '500' },
  bpmBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(255, 159, 10, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bpmBadgeText: { fontSize: 11, fontWeight: '700', color: studioColors.beatAccent },
  barRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  barCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: studioColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.surfaceElevated,
  },
  barPast: { borderColor: studioColors.accent, backgroundColor: 'rgba(59, 158, 255, 0.2)' },
  barActive: {
    borderColor: studioColors.accent,
    backgroundColor: studioColors.accent,
    transform: [{ scale: 1.08 }],
  },
  barLabel: { fontSize: 15, fontWeight: '600', color: studioColors.textSecondary },
  barLabelActive: { color: '#fff' },
});
