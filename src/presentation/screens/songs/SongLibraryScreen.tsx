import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTotalBars } from '../../../domain/music/SongUtils';
import type { Song } from '../../../domain/music/Song';
import { useSongLibrary } from '../../hooks/useSongLibrary';
import { useSongPlayback } from '../../hooks/useSongPlayback';
import type { SongsStackParamList } from '../../navigation/types';
import { studioColors } from '../../theme';

type Props = NativeStackScreenProps<SongsStackParamList, 'SongLibrary'>;

export default function SongLibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { songs, loading, error, createSong, deleteSong } = useSongLibrary();
  const playback = useSongPlayback();

  const showTransport = playback.isPlaying || playback.isPaused;

  const onCreateSong = async () => {
    const created = await createSong(`Song ${songs.length + 1}`);
    navigation.navigate('SongEditor', { songId: created.id });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Songs</Text>

      <View style={styles.modeBadge}>
        <Text style={styles.modeLabel}>Mode</Text>
        <Text style={styles.modeValue}>{playback.modeLabel}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => void onCreateSong()}>
        <Text style={styles.primaryButtonText}>+ New Song</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={studioColors.accent} />
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(song) => song.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <SongListItem
              song={item}
              onEdit={() => navigation.navigate('SongEditor', { songId: item.id })}
              onPlay={() => playback.onPlaySong(item)}
              onDelete={() => void deleteSong(item.id)}
            />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No songs saved yet.</Text>}
        />
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {playback.fallbackReason ? (
        <Text style={styles.fallback}>Fallback to Quick Metronome: {playback.fallbackReason}</Text>
      ) : null}

      {showTransport ? (
        <View style={styles.transportPanel}>
          <Text style={styles.nowPlaying}>Playing: {playback.songName ?? '—'}</Text>
          <Text style={styles.barPosition}>
            Bar {playback.currentBarIndex + 1} / {Math.max(playback.totalBars, 1)}
          </Text>
          <View style={styles.transportRow}>
            {!playback.isPlaying ? (
              <Pressable style={styles.secondaryButton} onPress={playback.onResume}>
                <Text style={styles.secondaryButtonText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.secondaryButton} onPress={playback.onPause}>
                <Text style={styles.secondaryButtonText}>Pause</Text>
              </Pressable>
            )}
            <Pressable style={styles.secondaryButton} onPress={playback.onStop}>
              <Text style={styles.secondaryButtonText}>Stop</Text>
            </Pressable>
          </View>
          <View style={styles.seekRow}>
            <Pressable style={styles.seekButton} onPress={playback.onSeekPreviousBar}>
              <Text style={styles.seekButtonText}>◀ Bar</Text>
            </Pressable>
            <Pressable style={styles.seekButton} onPress={playback.onSeekNextBar}>
              <Text style={styles.seekButtonText}>Bar ▶</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {__DEV__ && playback.debugTick ? (
        <View style={styles.debugOverlay}>
          <Text style={styles.debugTitle}>Song debug (dev)</Text>
          <Text style={styles.debugLine}>sequence: {playback.debugTick.sequenceIndex}</Text>
          <Text style={styles.debugLine}>barId: {playback.debugTick.barId}</Text>
          <Text style={styles.debugLine}>sectionId: {playback.debugTick.sectionId}</Text>
          <Text style={styles.debugLine}>bpm: {playback.debugTick.bpm}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SongListItem({
  song,
  onEdit,
  onPlay,
  onDelete,
}: {
  song: Song;
  onEdit: () => void;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const barCount = getTotalBars(song);

  return (
    <View style={styles.songCard}>
      <Text style={styles.songName}>{song.name}</Text>
      <Text style={styles.songMeta}>{barCount} bar{barCount === 1 ? '' : 's'}</Text>
      <View style={styles.songActions}>
        <Pressable style={styles.actionButton} onPress={onPlay}>
          <Text style={styles.actionButtonText}>Play Timeline</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onEdit}>
          <Text style={styles.actionButtonText}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.deleteAction]} onPress={onDelete}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: studioColors.background },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12, color: studioColors.textPrimary },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: studioColors.accentMutedBg,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modeLabel: { fontSize: 12, color: studioColors.textSecondary, textTransform: 'uppercase' },
  modeValue: { fontSize: 16, fontWeight: '700', color: studioColors.textPrimary },
  primaryButton: {
    backgroundColor: studioColors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loader: { marginTop: 24 },
  listContent: { gap: 12, paddingBottom: 16 },
  songCard: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: studioColors.surface,
  },
  songName: { fontSize: 17, fontWeight: '700', marginBottom: 4, color: studioColors.textPrimary },
  songMeta: { fontSize: 13, color: studioColors.textSecondary, marginBottom: 10 },
  songActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: studioColors.textPrimary },
  deleteAction: { backgroundColor: 'rgba(255, 69, 58, 0.18)' },
  deleteActionText: { color: studioColors.stop, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: studioColors.textSecondary, marginTop: 24 },
  errorText: { color: studioColors.beatAccent, marginTop: 8 },
  fallback: { color: studioColors.beatAccent, marginTop: 8, fontSize: 13 },
  transportPanel: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: studioColors.border,
  },
  nowPlaying: { fontSize: 14, marginBottom: 4, color: studioColors.textPrimary },
  barPosition: { fontSize: 13, color: studioColors.textSecondary, marginBottom: 8 },
  transportRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  secondaryButton: {
    flex: 1,
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: studioColors.textPrimary },
  seekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  seekButton: {
    flex: 1,
    backgroundColor: studioColors.surface,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  seekButtonText: { fontSize: 14, fontWeight: '600', color: studioColors.textPrimary },
  debugOverlay: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: studioColors.surfaceElevated,
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  debugTitle: { color: studioColors.accent, fontWeight: '700', marginBottom: 8 },
  debugLine: { color: studioColors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginBottom: 4 },
});
