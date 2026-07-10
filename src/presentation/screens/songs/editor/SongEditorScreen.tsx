import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSong } from '../../../../domain/music/Song';
import { SongTimelineView, TimelinePlaybackPanel } from '../../../../components/songTimeline';
import { meterOptions, useSongEditor } from '../../../hooks/useSongEditor';
import { useSongPlayback } from '../../../hooks/useSongPlayback';
import { useTimelinePlaybackViewModels } from '../../../hooks/useTimelinePlaybackViewModels';
import type { SongsStackParamList } from '../../../navigation/types';
import { studioColors } from '../../../theme';

type Props = NativeStackScreenProps<SongsStackParamList, 'SongEditor'>;

export default function SongEditorScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { songId } = route.params;
  const {
    song,
    loading,
    saving,
    error,
    setSongName,
    addBar,
    setSegmentBarCount,
    setSegmentMeter,
    setSegmentBpmOverride,
    setSegmentAccent,
  } = useSongEditor(songId);

  const playback = useSongPlayback();
  const meterChoices = meterOptions();
  const placeholderSong = useMemo(
    () => createSong({ id: 'loading', name: '', sections: [] }),
    [],
  );

  const timeline = useTimelinePlaybackViewModels({
    song: song ?? placeholderSong,
    currentBarIndex: playback.currentBarIndex,
    totalBars: playback.totalBars,
    songName: playback.songName,
    isPlaying: playback.isPlaying,
    isPaused: playback.isPaused,
  });

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={studioColors.accent} />
      </View>
    );
  }

  if (song === null) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error ?? 'Song not found'}</Text>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Songs</Text>
        </Pressable>
        {saving ? <Text style={styles.saving}>Saving…</Text> : null}
      </View>

      <Text style={styles.title}>{song.name}</Text>

      <Text style={styles.label}>Song name</Text>
      <SongNameInput initialName={song.name} onCommit={setSongName} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.transportRow}>
        <Pressable
          style={[styles.transportButton, styles.playButton]}
          onPress={() => playback.onPlaySong(song)}
        >
          <Text style={styles.playButtonText}>▶ Play</Text>
        </Pressable>
        {timeline.showTransport ? (
          <>
            {!playback.isPlaying ? (
              <Pressable style={styles.transportButton} onPress={playback.onResume}>
                <Text style={styles.transportButtonText}>Resume</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.transportButton} onPress={playback.onPause}>
                <Text style={styles.transportButtonText}>Pause</Text>
              </Pressable>
            )}
            <Pressable style={styles.transportButton} onPress={playback.onStop}>
              <Text style={styles.transportButtonText}>Stop</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {timeline.showTransport ? (
        <View style={styles.seekRow}>
          <Pressable style={styles.seekButton} onPress={playback.onSeekPreviousBar}>
            <Text style={styles.seekButtonText}>◀ Bar</Text>
          </Pressable>
          <Pressable style={styles.seekButton} onPress={playback.onSeekNextBar}>
            <Text style={styles.seekButtonText}>Bar ▶</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.timelineArea}>
        <SongTimelineView
          song={song}
          segments={timeline.segments}
          meterOptions={meterChoices}
          isTimelineActive={timeline.isTimelineActive}
          currentBarIndex={playback.currentBarIndex}
          onSegmentBarCountChange={setSegmentBarCount}
          onSegmentMeterChange={setSegmentMeter}
          onSegmentBpmOverrideChange={setSegmentBpmOverride}
          onSegmentAccentChange={setSegmentAccent}
        />
      </View>

      <TimelinePlaybackPanel status={timeline.playbackStatus} />

      <Pressable style={styles.addBarButton} onPress={addBar}>
        <Text style={styles.addBarButtonText}>+ Add Bar</Text>
      </Pressable>
    </View>
  );
}

function SongNameInput({
  initialName,
  onCommit,
}: {
  initialName: string;
  onCommit: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <TextInput
      style={styles.input}
      value={name}
      onChangeText={setName}
      onEndEditing={() => onCommit(name)}
      placeholder="Song name"
      placeholderTextColor={studioColors.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: studioColors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: studioColors.background,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backLink: { color: studioColors.accent, fontSize: 16, marginBottom: 4 },
  saving: { color: studioColors.textSecondary, fontSize: 13 },
  title: { fontSize: 22, fontWeight: '800', color: studioColors.textPrimary, marginBottom: 4 },
  label: { fontSize: 12, color: studioColors.textSecondary, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: studioColors.textPrimary,
    backgroundColor: studioColors.surface,
  },
  transportRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  transportButton: {
    flex: 1,
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  transportButtonText: { fontWeight: '600', color: studioColors.textPrimary },
  playButton: { backgroundColor: studioColors.accent },
  playButtonText: { color: '#fff', fontWeight: '700' },
  seekRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  seekButton: {
    flex: 1,
    backgroundColor: studioColors.surface,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: studioColors.border,
  },
  seekButtonText: { fontWeight: '600', color: studioColors.textPrimary },
  timelineArea: { flex: 1, minHeight: 220 },
  addBarButton: {
    marginTop: 10,
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBarButtonText: { fontWeight: '600', color: studioColors.textPrimary },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { fontWeight: '600', color: studioColors.textPrimary },
  errorText: { color: studioColors.beatAccent, marginBottom: 8 },
});
