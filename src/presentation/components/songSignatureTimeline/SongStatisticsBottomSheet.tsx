import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Song } from '../../../domain/music';
import { studioColors } from '../../theme';
import { buildSongStatistics, type SongStatistics } from '../../viewModels/buildSongStatistics';

type Props = {
  visible: boolean;
  song: Song;
  onClose: () => void;
};

type StatAccent = {
  readonly color: string;
  readonly icon: keyof typeof Ionicons.glyphMap;
};

const STAT_ACCENTS = {
  structure: { color: '#3B9EFF', icon: 'git-network-outline' },
  tempo: { color: '#E040FB', icon: 'speedometer-outline' },
  playback: { color: '#5AC8FA', icon: 'timer-outline' },
  meters: { color: '#A855F7', icon: 'musical-notes-outline' },
  accents: { color: '#7DD3FC', icon: 'pulse-outline' },
  song: { color: '#94A3B8', icon: 'document-text-outline' },
} as const satisfies Record<string, StatAccent>;

type StatCardProps = {
  accent: StatAccent;
  title: string;
  primary: string;
  secondary: string;
  tertiary?: string | null;
  /** Smaller primary for long text (e.g. song name). */
  primaryCompact?: boolean;
  /**
   * Song card only: primary spans nearly the full card width (not the
   * numeric maxWidth column) and truncates with a trailing ellipsis.
   */
  primaryFullWidth?: boolean;
  /** Time Signatures only: tertiary list scrolls horizontally when too long. */
  scrollableTertiary?: boolean;
};

function StatCard({
  accent,
  title,
  primary,
  secondary,
  tertiary,
  primaryCompact = false,
  primaryFullWidth = false,
  scrollableTertiary = false,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.leftContent}>
        <View style={styles.cardHeader}>
          <Ionicons name={accent.icon} size={16} color={accent.color} />
          <Text style={[styles.cardTitle, { color: accent.color }]} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View style={styles.cardSpacer} />

        <View style={styles.metaColumn}>
          <Text style={styles.secondaryValue} numberOfLines={1}>
            {secondary}
          </Text>
          {tertiary ? (
            scrollableTertiary ? (
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                style={styles.tertiaryScroll}
                contentContainerStyle={styles.tertiaryScrollContent}
              >
                <Text
                  style={[styles.tertiaryValue, styles.tertiaryValueInScroll]}
                  numberOfLines={1}
                >
                  {tertiary}
                </Text>
              </ScrollView>
            ) : (
              <Text style={styles.tertiaryValue}>{tertiary}</Text>
            )
          ) : null}
        </View>
      </View>

      <View
        style={primaryFullWidth ? styles.primarySlotFullWidth : styles.primarySlot}
        pointerEvents="none"
      >
        <Text
          style={[
            styles.primaryValue,
            primaryCompact && styles.primaryValueCompact,
            primaryFullWidth && styles.primaryValueFullWidth,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit={!primaryFullWidth && !primaryCompact}
          minimumFontScale={0.55}
        >
          {primary}
        </Text>
      </View>
    </View>
  );
}

function cardsFromStats(stats: SongStatistics): readonly StatCardProps[] {
  const metersList =
    stats.uniqueMeters.length > 0 ? stats.uniqueMeters.join(' · ') : '—';

  return [
    {
      accent: STAT_ACCENTS.structure,
      title: 'Structure',
      primary: String(stats.totalBars),
      secondary: 'Total Bars',
      tertiary: `${stats.totalSegments} Segment${stats.totalSegments === 1 ? '' : 's'}`,
    },
    {
      accent: STAT_ACCENTS.tempo,
      title: 'Tempo',
      primary: String(stats.globalBpm),
      secondary: 'Global BPM',
      tertiary: `${stats.tempoChangeCount} Tempo Change${stats.tempoChangeCount === 1 ? '' : 's'}`,
    },
    {
      accent: STAT_ACCENTS.playback,
      title: 'Playback',
      primary: stats.estimatedDurationLabel,
      secondary: 'Est. Duration',
      tertiary: `${stats.totalBeats} Beat${stats.totalBeats === 1 ? '' : 's'}`,
    },
    {
      accent: STAT_ACCENTS.meters,
      title: 'Time Signatures',
      primary: String(stats.uniqueMeterCount),
      secondary: stats.uniqueMeterCount === 1 ? 'Signature' : 'Signatures',
      tertiary: metersList,
      scrollableTertiary: true,
    },
    {
      accent: STAT_ACCENTS.accents,
      title: 'Accents',
      primary: String(stats.accentPatternCount),
      secondary: 'Accents Pattern',
      tertiary: stats.mostCommonAccentLabel
        ? `Most Used: ${stats.mostCommonAccentLabel}`
        : null,
    },
    {
      accent: STAT_ACCENTS.song,
      title: 'Song',
      primary: stats.songName,
      secondary: 'Song Name',
      tertiary: stats.lastModifiedLabel
        ? `Modified ${stats.lastModifiedLabel}`
        : null,
      primaryCompact: true,
      primaryFullWidth: true,
    },
  ];
}

/**
 * Read-only Cubase-inspired song overview dashboard (2×3 cards).
 * Landscape-first; fits one screen without scrolling when possible.
 */
export function SongStatisticsBottomSheet({ visible, song, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const stats = useMemo(() => (visible ? buildSongStatistics(song) : null), [visible, song]);
  const cards = stats === null ? [] : cardsFromStats(stats);

  const edgeMargin = landscape ? 14 : 12;
  const panelMaxWidth = landscape ? Math.min(920, width - edgeMargin * 2) : width - edgeMargin * 2;
  const panelMaxHeight =
    height - Math.max(insets.top, edgeMargin) - Math.max(insets.bottom, edgeMargin);
  const panelHeight = landscape ? panelMaxHeight : undefined;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
    >
      <View
        style={[
          styles.modalRoot,
          {
            paddingTop: Math.max(insets.top, edgeMargin),
            paddingBottom: Math.max(insets.bottom, edgeMargin),
            paddingHorizontal: edgeMargin,
          },
        ]}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" />

        <View
          style={[
            styles.panel,
            {
              maxWidth: panelMaxWidth,
              maxHeight: panelMaxHeight,
              height: panelHeight,
              width: '100%',
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle}>Song Statistics</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close song statistics"
            >
              <Text style={styles.doneLink}>Done</Text>
            </Pressable>
          </View>

          <View style={[styles.grid, !landscape && styles.gridPortrait]}>
            {[0, 1].map((row) => (
              <View key={`row-${row}`} style={[styles.gridRow, !landscape && styles.gridRowPortrait]}>
                {cards.slice(row * 3, row * 3 + 3).map((card) => (
                  <View
                    key={card.title}
                    style={[styles.gridCell, !landscape && styles.gridCellPortrait]}
                  >
                    <StatCard {...card} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: studioColors.overlay,
  },
  panel: {
    backgroundColor: '#12171C',
    borderColor: studioColors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  headerTitles: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  doneLink: {
    fontSize: 16,
    fontWeight: '700',
    color: studioColors.accent,
  },
  grid: {
    flex: 1,
    gap: 10,
  },
  gridPortrait: {
    flexGrow: 0,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  gridRowPortrait: {
    flexWrap: 'wrap',
    flex: 0,
  },
  gridCell: {
    flex: 1,
    minHeight: 0,
  },
  gridCellPortrait: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 108,
  },
  card: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1A2026',
    borderColor: studioColors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  /**
   * Left inspector column — participates in card padding (not absolute),
   * and only reserves a slim right inset for the absolute primary value.
   */
  leftContent: {
    flex: 1,
    // alignSelf: 'stretch',
    // paddingRight: 56,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardSpacer: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 24,
  },
  metaColumn: {
    alignSelf: 'stretch',
  },
  primarySlot: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
    maxWidth: '48%',
  },
  /** Song card: primary uses nearly the full card width (16dp side insets). */
  primarySlotFullWidth: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 16,
    right: 16,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  primaryValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    color: studioColors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    textAlign: 'right',
  },
  primaryValueCompact: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  primaryValueFullWidth: {
    width: '100%',
  },
  secondaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: studioColors.textSecondary,
  },
  tertiaryValue: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '500',
    color: studioColors.textMuted,
  },
  tertiaryScroll: {
    marginTop: 3,
  },
  tertiaryScrollContent: {
    alignItems: 'center',
  },
  tertiaryValueInScroll: {
    marginTop: 0,
    flexShrink: 0,
  },
});
