import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatMeter } from '../../../../domain/music/Meter';
import type { Bar } from '../../../../domain/music/Bar';
import { formatBarMeter, meterOptions, useSongEditor } from '../../../hooks/useSongEditor';
import type { SongsStackParamList } from '../../../navigation/types';

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
    deleteBar,
    moveBarUp,
    moveBarDown,
    setBarMeter,
    setBarBpm,
  } = useSongEditor(songId);

  const bars = song?.sections[0]?.bars ?? [];
  const meterChoices = meterOptions();

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
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
    <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>← Songs</Text>
        </Pressable>
        {saving ? <Text style={styles.saving}>Saving…</Text> : null}
      </View>

      <Text style={styles.title}>Edit Song</Text>

      <Text style={styles.label}>Name</Text>
      <SongNameInput initialName={song.name} onCommit={setSongName} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.toolbar}>
        <Pressable style={styles.primaryButton} onPress={addBar}>
          <Text style={styles.primaryButtonText}>+ Add Bar</Text>
        </Pressable>
      </View>

      <FlatList
        data={bars}
        keyExtractor={(bar) => bar.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: bar, index }) => (
          <BarEditorRow
            bar={bar}
            index={index}
            totalBars={bars.length}
            meterLabel={formatBarMeter(song, bar.id)}
            meterChoices={meterChoices}
            onDelete={() => deleteBar(bar.id)}
            onMoveUp={() => moveBarUp(bar.id)}
            onMoveDown={() => moveBarDown(bar.id)}
            onMeterChange={(meter) => setBarMeter(bar.id, meter)}
            onBpmChange={(bpm) => setBarBpm(bar.id, bpm)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No bars yet. Add a bar to begin.</Text>}
      />
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
    />
  );
}

function BarEditorRow({
  bar,
  index,
  totalBars,
  meterLabel,
  meterChoices,
  onDelete,
  onMoveUp,
  onMoveDown,
  onMeterChange,
  onBpmChange,
}: {
  bar: Bar;
  index: number;
  totalBars: number;
  meterLabel: string;
  meterChoices: string[];
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMeterChange: (meter: string) => void;
  onBpmChange: (bpm: string) => void;
}) {
  const [bpmText, setBpmText] = useState(bar.tempo?.bpm?.toString() ?? '');

  return (
    <View style={styles.barCard}>
      <Text style={styles.barTitle}>Bar {index + 1}</Text>
      <Text style={styles.barMeta}>Meter: {formatMeter(bar.meter)}</Text>

      <Text style={styles.label}>Meter</Text>
      <View style={styles.meterRow}>
        {meterChoices.map((meter) => (
          <Pressable
            key={meter}
            style={[styles.chip, meter === meterLabel && styles.chipSelected]}
            onPress={() => onMeterChange(meter)}
          >
            <Text style={[styles.chipText, meter === meterLabel && styles.chipTextSelected]}>{meter}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>BPM override (optional)</Text>
      <TextInput
        style={styles.input}
        value={bpmText}
        keyboardType="numeric"
        placeholder="inherit"
        onChangeText={setBpmText}
        onEndEditing={() => onBpmChange(bpmText)}
      />

      <View style={styles.barActions}>
        <Pressable style={styles.smallButton} disabled={index === 0} onPress={onMoveUp}>
          <Text style={styles.smallButtonText}>↑</Text>
        </Pressable>
        <Pressable style={styles.smallButton} disabled={index >= totalBars - 1} onPress={onMoveDown}>
          <Text style={styles.smallButtonText}>↓</Text>
        </Pressable>
        <Pressable style={[styles.smallButton, styles.deleteButton]} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backLink: { color: '#1a73e8', fontSize: 16, marginBottom: 8 },
  saving: { color: '#666', fontSize: 13 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d7e2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  toolbar: { marginVertical: 12 },
  primaryButton: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#eef2f7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: { fontWeight: '600' },
  listContent: { paddingBottom: 24, gap: 12 },
  barCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  barTitle: { fontSize: 16, fontWeight: '700' },
  barMeta: { fontSize: 12, color: '#666', marginBottom: 4 },
  meterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: '#1a73e8', borderColor: '#1a73e8' },
  chipText: { fontSize: 13, color: '#334155' },
  chipTextSelected: { color: '#fff' },
  barActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  smallButton: {
    backgroundColor: '#eef2f7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallButtonText: { fontWeight: '700' },
  deleteButton: { marginLeft: 'auto', backgroundColor: '#fee2e2' },
  deleteButtonText: { color: '#b91c1c', fontWeight: '600' },
  empty: { color: '#666', textAlign: 'center', marginTop: 24 },
  errorText: { color: '#b45309', marginBottom: 8 },
});
