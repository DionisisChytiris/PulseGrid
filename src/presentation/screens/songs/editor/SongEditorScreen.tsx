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
import { sanitizeSongName, sanitizeSongNameInput } from '../../../../domain/music/songName';
import { CustomKeyboard } from '../../../components/CustomKeyboard';
import {
  SongSignatureTimeline,
  SongStatisticsBottomSheet,
} from '../../../components/songSignatureTimeline';
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
  const [statsVisible, setStatsVisible] = useState(false);
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
    duplicateSegment,
    deleteSegment,
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
      setSongName(sanitizeSongName(keyboard.value));
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
          <Text style={styles.backLink}>← </Text>
        </Pressable>

        <SongNameInput
          name={song.name}
          draft={songNameKeyboardVisible ? keyboard.value : song.name}
          focused={songNameKeyboardVisible}
          onRegister={(ref) => keyboard.registerInput('songName', ref)}
          onFocus={(current) => keyboard.focusField('songName', current, 'letters')}
          onDraftChange={(value) => {
            if (keyboard.activeField === 'songName') {
              keyboard.setValue(sanitizeSongNameInput(value));
            }
          }}
        />

        <Pressable
          style={styles.statsButton}
          onPress={() => setStatsVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Song statistics"
          hitSlop={8}
        >
          <Ionicons name="stats-chart-outline" size={20} color={studioColors.textSecondary} />
        </Pressable>

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
          onSegmentDuplicate={duplicateSegment}
          onSegmentDelete={deleteSegment}
          onSongDefaultBpmChange={setSongDefaultBpm}
          onPlayFromSegment={(segment) => {
            playback.onPlaySongFromBar(song, segment.startBar - 1);
          }}
          onAddBar={addBar}
        />
      </View>

      <CustomKeyboard
        visible={songNameKeyboardVisible}
        value={songNameKeyboardVisible ? keyboard.value : ''}
        onChangeText={(value) => keyboard.setValue(sanitizeSongNameInput(value))}
        onDone={commitSongName}
        placement="auto"
        initialMode="letters"
      />

      <SongStatisticsBottomSheet
        visible={statsVisible}
        song={song}
        onClose={() => setStatsVisible(false)}
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
        const next = sanitizeSongNameInput(text);
        setLocal(next);
        onDraftChange(next);
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
    flexGrow: 0,
    flexShrink: 1,
    width: '70%',
    maxWidth: '70%',
    minWidth: 200,
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
  statsButton: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.surface,
  },
  transportButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: { backgroundColor: studioColors.accent, marginHorizontal: 20 },
  stopButton: { backgroundColor: studioColors.stop, marginHorizontal: 20 },
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
