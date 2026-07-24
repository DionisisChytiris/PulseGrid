import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createSong } from '../../../../domain/music/Song';
import { CustomKeyboard } from '../../../components/CustomKeyboard';
import { SongSignatureTimeline } from '../../../components/songSignatureTimeline';
import { useEditorCustomKeyboard } from '../../../hooks/useEditorCustomKeyboard';
import { useSongEditor } from '../../../hooks/useSongEditor';
import { useSongEditorLandscapeLock } from '../../../hooks/useSongEditorLandscapeLock';
import { useSongPlayback } from '../../../hooks/useSongPlayback';
import { useTimelinePlaybackViewModels } from '../../../hooks/useTimelinePlaybackViewModels';
import type { SongsStackParamList } from '../../../navigation/types';
import { studioColors } from '../../../theme';

type Props = NativeStackScreenProps<SongsStackParamList, 'SongEditor'>;

export default function SongEditorScreen({ navigation, route }: Props) {
  useSongEditorLandscapeLock();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { songId } = route.params;
  const {
    song,
    loading,
    saving,
    error,
    setSongName,
    setSongDefaultBpm,
    addBar,
    setSegmentBarCount,
    setSegmentMeter,
    setSegmentBpmOverride,
    setSegmentAccentPattern,
  } = useSongEditor(songId);

  const playback = useSongPlayback();
  const keyboard = useEditorCustomKeyboard();
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

  const songNameKeyboardVisible = keyboard.activeField === 'songName';
  const dockRight = songNameKeyboardVisible && width > height;
  const rightPad = dockRight ? Math.round(width * 0.45) : Math.max(insets.right, 12);
  const bottomPad =
    songNameKeyboardVisible && !dockRight
      ? Math.max(insets.bottom, 12) + 240
      : insets.bottom + 8;

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

  const commitSongName = () => {
    if (keyboard.activeField === 'songName') {
      const next = keyboard.value.trim().length > 0 ? keyboard.value.trim() : song.name;
      setSongName(next);
    }
    keyboard.dismiss();
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          paddingBottom: bottomPad,
          paddingLeft: Math.max(insets.left, 12),
          paddingRight: rightPad,
        },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backLink}>← Songs</Text>
        </Pressable>

        <SongNameInput
          name={song.name}
          draft={songNameKeyboardVisible ? keyboard.value : song.name}
          focused={songNameKeyboardVisible}
          onRegister={(ref) => keyboard.registerInput('songName', ref)}
          onFocus={(current) => keyboard.focusField('songName', current, 'letters')}
          onDraftChange={(value) => {
            if (keyboard.activeField === 'songName') {
              keyboard.setValue(value);
            }
          }}
        />

        <Pressable
          style={[
            styles.transportButton,
            timeline.showTransport ? styles.stopButton : styles.playButton,
          ]}
          onPress={
            timeline.showTransport
              ? playback.onStop
              : () => playback.onPlaySong(song)
          }
          accessibilityRole="button"
          accessibilityLabel={timeline.showTransport ? 'Stop playback' : 'Start playback'}
        >
          <Ionicons
            name={timeline.showTransport ? 'stop' : 'play'}
            size={20}
            color="#fff"
          />
        </Pressable>

        {saving ? <Text style={styles.saving}>Saving…</Text> : null}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.timelineArea}>
        <SongSignatureTimeline
          song={song}
          segments={timeline.segments}
          isTimelineActive={timeline.isTimelineActive}
          isPlaying={playback.isPlaying}
          currentBarIndex={playback.currentBarIndex}
          currentBeatIndex={timeline.playbackStatus.currentBeat - 1}
          currentBpm={timeline.playbackStatus.tempo}
          currentMeter={timeline.playbackStatus.meter}
          onSegmentBarCountChange={setSegmentBarCount}
          onSegmentMeterChange={setSegmentMeter}
          onSegmentBpmOverrideChange={setSegmentBpmOverride}
          onSegmentAccentPatternChange={setSegmentAccentPattern}
          onSongDefaultBpmChange={setSongDefaultBpm}
          onAddBar={addBar}
        />
      </View>

      <CustomKeyboard
        visible={songNameKeyboardVisible}
        value={songNameKeyboardVisible ? keyboard.value : ''}
        onChangeText={keyboard.setValue}
        onDone={commitSongName}
        placement="auto"
        initialMode="letters"
      />
    </View>
  );
}

function SongNameInput({
  name,
  draft,
  focused,
  onRegister,
  onFocus,
  onDraftChange,
}: {
  name: string;
  draft: string;
  focused: boolean;
  onRegister: (ref: TextInput | null) => void;
  onFocus: (current: string) => void;
  onDraftChange: (value: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [local, setLocal] = useState(name);

  useEffect(() => {
    if (!focused) {
      setLocal(name);
      inputRef.current?.blur();
    }
  }, [focused, name]);

  const display = focused ? draft : local;

  return (
    <TextInput
      ref={(ref) => {
        inputRef.current = ref;
        onRegister(ref);
      }}
      style={[styles.nameInput, focused && styles.nameInputFocused]}
      value={display}
      onChangeText={(text) => {
        setLocal(text);
        onDraftChange(text);
      }}
      onFocus={() => onFocus(local)}
      placeholder="Song name"
      placeholderTextColor={studioColors.textMuted}
      showSoftInputOnFocus={false}
      disableFullscreenUI
      caretHidden={!focused}
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
  nameInputFocused: {
    borderColor: studioColors.accent,
  },
  transportButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: { backgroundColor: studioColors.accent },
  stopButton: { backgroundColor: studioColors.stop },
  saving: { color: studioColors.textSecondary, fontSize: 12 },
  timelineArea: {
    flex: 1,
    minHeight: 160,
  },
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
