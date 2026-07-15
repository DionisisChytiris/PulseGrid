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
import { TimelinePlaybackPanel } from '../../../../components/songTimeline';
import { SongSignatureTimeline } from '../../../components/songSignatureTimeline';
import { meterOptions, useSongEditor } from '../../../hooks/useSongEditor';
import { useSongEditorLandscapeLock } from '../../../hooks/useSongEditorLandscapeLock';
import { useSongPlayback } from '../../../hooks/useSongPlayback';
import { useTimelinePlaybackViewModels } from '../../../hooks/useTimelinePlaybackViewModels';
import type { SongsStackParamList } from '../../../navigation/types';
import { studioColors } from '../../../theme';

type Props = NativeStackScreenProps<SongsStackParamList, 'SongEditor'>;

export default function SongEditorScreen({ navigation, route }: Props) {
  useSongEditorLandscapeLock();
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
        {
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 8,
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: Math.max(insets.right, 12),
        },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>← Songs</Text>
        </Pressable>

        <SongNameInput initialName={song.name} onCommit={setSongName} />

        <View style={styles.transportCluster}>
          <Pressable
            style={[styles.transportButton, styles.playButton]}
            onPress={() => playback.onPlaySong(song)}
          >
            <Text style={styles.playButtonText}>Play</Text>
          </Pressable>
          {timeline.showTransport ? (
            <>
              <Pressable style={styles.transportButton} onPress={playback.onSeekPreviousBar}>
                <Text style={styles.transportButtonText}>Prev</Text>
              </Pressable>
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
              <Pressable style={styles.transportButton} onPress={playback.onSeekNextBar}>
                <Text style={styles.transportButtonText}>Next</Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {saving ? <Text style={styles.saving}>Saving…</Text> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.timelineArea}>
        <SongSignatureTimeline
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

      <View style={styles.footer}>
        <TimelinePlaybackPanel status={timeline.playbackStatus} />
        <Pressable style={styles.addBarButton} onPress={addBar}>
          <Text style={styles.addBarButtonText}>+ Add Bar</Text>
        </Pressable>
      </View>
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
      style={styles.nameInput}
      value={name}
      onChangeText={setName}
      onEndEditing={() => onCommit(name)}
      placeholder="Song name"
      placeholderTextColor={studioColors.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: studioColors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: studioColors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  backLink: {
    color: studioColors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  nameInput: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '700',
    color: studioColors.textPrimary,
    backgroundColor: studioColors.surface,
  },
  transportCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transportButton: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  transportButtonText: { fontWeight: '600', color: studioColors.textPrimary, fontSize: 12 },
  playButton: { backgroundColor: studioColors.accent },
  playButtonText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  saving: { color: studioColors.textSecondary, fontSize: 12 },
  timelineArea: {
    flex: 1,
    minHeight: 160,
  },
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    marginTop: 6,
  },
  addBarButton: {
    backgroundColor: studioColors.surfaceElevated,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addBarButtonText: { fontWeight: '600', color: studioColors.textPrimary, fontSize: 13 },
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
