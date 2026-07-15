import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Song } from '../../../domain/music/Song';
import { useSongLibrary } from '../../hooks/useSongLibrary';
import type { SongsStackParamList } from '../../navigation/types';
import { studioColors } from '../../theme';

type Props = NativeStackScreenProps<SongsStackParamList, 'SongLibrary'>;

const DELETE_WIDTH = 92;
const OPEN_THRESHOLD = 48;

export default function SongLibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { songs, loading, error, createSong, deleteSong } = useSongLibrary();

  const onCreateSong = async () => {
    const created = await createSong(`Song ${songs.length + 1}`);
    navigation.navigate('SongEditor', { songId: created.id });
  };

  const confirmDeleteSong = (song: Song) => {
    Alert.alert('Delete song?', `"${song.name}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void deleteSong(song.id),
      },
    ]);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom - 10 },
      ]}
    >
      <Text style={styles.title}>Songs</Text>

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator style={styles.loader} color={studioColors.accent} />
        ) : (
          <FlatList
            style={styles.list}
            data={songs}
            keyExtractor={(song) => song.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <SongListItem
                song={item}
                onOpen={() => navigation.navigate('SongEditor', { songId: item.id })}
                onDelete={() => confirmDeleteSong(item)}
              />
            )}
            ListEmptyComponent={<Text style={styles.empty}>No songs saved yet.</Text>}
          />
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={() => void onCreateSong()}>
          <Text style={styles.primaryButtonText}>+ New Song</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SongListItem({
  song,
  onOpen,
  onDelete,
}: {
  song: Song;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const openOffset = useRef(0);

  const animateTo = (toValue: number) => {
    openOffset.current = toValue;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_event, gesture) => {
        const next = Math.min(0, Math.max(-DELETE_WIDTH, openOffset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_event, gesture) => {
        const current = Math.min(0, Math.max(-DELETE_WIDTH, openOffset.current + gesture.dx));
        const shouldOpen = gesture.vx < -0.35 || current < -OPEN_THRESHOLD;
        animateTo(shouldOpen ? -DELETE_WIDTH : 0);
      },
      onPanResponderTerminate: () => {
        animateTo(openOffset.current < -OPEN_THRESHOLD / 2 ? -DELETE_WIDTH : 0);
      },
    }),
  ).current;

  return (
    <View style={styles.rowContainer}>
      <View style={styles.deleteAction}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            animateTo(0);
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${song.name}`}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.rowForeground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <Pressable
          style={({ pressed }) => [styles.songRow, pressed && styles.songRowPressed]}
          onPress={() => {
            if (openOffset.current !== 0) {
              animateTo(0);
              return;
            }
            onOpen();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${song.name}`}
          accessibilityHint="Opens the song editor. Swipe left to delete this song."
        >
          <Ionicons name="musical-note" size={22} color={studioColors.accent} />
          <Text style={styles.songName}>{song.name}</Text>
          <Ionicons name="chevron-forward" size={20} color={studioColors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, backgroundColor: studioColors.background },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 12, color: studioColors.textPrimary },
  content: { flex: 1 },
  list: { flex: 1 },
  footer: { alignItems: 'center' },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: studioColors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loader: { marginTop: 24 },
  listContent: { paddingBottom: 16 },
  rowContainer: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  deleteAction: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    backgroundColor: studioColors.danger,
  },
  deleteButton: {
    width: DELETE_WIDTH,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowForeground: {
    backgroundColor: studioColors.background,
  },
  songRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    backgroundColor: studioColors.surface,
  },
  songRowPressed: { backgroundColor: studioColors.surfaceElevated },
  songName: { flex: 1, fontSize: 17, fontWeight: '600', color: studioColors.textPrimary },
  empty: { textAlign: 'center', color: studioColors.textSecondary, marginTop: 24 },
  errorText: { color: studioColors.beatAccent, marginTop: 8 },
});
