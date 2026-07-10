import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

import { AccentBeatPreview } from './AccentBeatPreview';

export const ACCENT_PRESET_OPTIONS = [
  { id: 'downbeat', label: 'Downbeat (▲ ○ ○ ○)' },
  { id: 'all', label: 'All beats (▲ ▲ ▲ ▲)' },
  { id: 'grouped-322', label: '7/8 grouped (▲ ○ ▲ ○ ▲ ○ ○)' },
] as const;

type Props = {
  visible: boolean;
  segment: TimelineSegmentViewModel | null;
  meterOptions: readonly string[];
  onClose: () => void;
  onBarCountChange: (count: number) => void;
  onMeterChange: (meterLabel: string) => void;
  onBpmOverrideChange: (bpm: number | null) => void;
  onAccentChange: (presetId: string) => void;
};

export function SegmentEditBottomSheet({
  visible,
  segment,
  meterOptions,
  onClose,
  onBarCountChange,
  onMeterChange,
  onBpmOverrideChange,
  onAccentChange,
}: Props) {
  const insets = useSafeAreaInsets();

  if (segment === null) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Edit Segment</Text>
        <Text style={styles.subtitle}>
          {segment.meter} · {segment.startBar === segment.endBar ? `Bar ${segment.startBar}` : `Bars ${segment.startBar}–${segment.endBar}`}
        </Text>

        <ScrollView style={styles.body}>
          <SegmentEditorFields
            segment={segment}
            meterOptions={meterOptions}
            onBarCountChange={onBarCountChange}
            onMeterChange={onMeterChange}
            onBpmOverrideChange={onBpmOverrideChange}
            onAccentChange={onAccentChange}
          />
        </ScrollView>

        <Pressable style={styles.doneButton} onPress={onClose}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function SegmentEditorFields({
  segment,
  meterOptions,
  onBarCountChange,
  onMeterChange,
  onBpmOverrideChange,
  onAccentChange,
}: {
  segment: TimelineSegmentViewModel;
  meterOptions: readonly string[];
  onBarCountChange: (count: number) => void;
  onMeterChange: (meterLabel: string) => void;
  onBpmOverrideChange: (bpm: number | null) => void;
  onAccentChange: (presetId: string) => void;
}) {
  const [barCountText, setBarCountText] = useState(String(segment.numberOfBars));
  const [bpmEnabled, setBpmEnabled] = useState(segment.bpmOverride !== null);
  const [bpmText, setBpmText] = useState(
    segment.bpmOverride !== null ? String(segment.bpmOverride) : '',
  );

  useEffect(() => {
    setBarCountText(String(segment.numberOfBars));
    setBpmEnabled(segment.bpmOverride !== null);
    setBpmText(segment.bpmOverride !== null ? String(segment.bpmOverride) : '');
  }, [segment.bpmOverride, segment.numberOfBars]);

  return (
    <>
      <Text style={styles.label}>Bars in segment</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={barCountText}
        placeholderTextColor={studioColors.textMuted}
        onChangeText={setBarCountText}
        onEndEditing={() => {
          const parsed = Number(barCountText);
          if (Number.isInteger(parsed) && parsed > 0) {
            onBarCountChange(parsed);
          } else {
            setBarCountText(String(segment.numberOfBars));
          }
        }}
      />

      <Text style={styles.label}>Time signature</Text>
      <View style={styles.chipRow}>
        {meterOptions.map((meter) => (
          <Pressable
            key={meter}
            style={[styles.chip, meter === segment.meter && styles.chipSelected]}
            onPress={() => onMeterChange(meter)}
          >
            <Text style={[styles.chipText, meter === segment.meter && styles.chipTextSelected]}>
              {meter}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>BPM override (metadata)</Text>
        <Switch
          value={bpmEnabled}
          trackColor={{ false: studioColors.border, true: studioColors.accent }}
          thumbColor="#FFFFFF"
          onValueChange={(enabled) => {
            setBpmEnabled(enabled);
            if (!enabled) {
              setBpmText('');
              onBpmOverrideChange(null);
            }
          }}
        />
      </View>

      {bpmEnabled ? (
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="e.g. 140"
          placeholderTextColor={studioColors.textMuted}
          value={bpmText}
          onChangeText={setBpmText}
          onEndEditing={() => {
            const trimmed = bpmText.trim();
            if (trimmed.length === 0) {
              onBpmOverrideChange(null);
              return;
            }

            const bpm = Number(trimmed);
            if (Number.isFinite(bpm) && bpm > 0) {
              onBpmOverrideChange(bpm);
            }
          }}
        />
      ) : (
        <Text style={styles.hint}>Inherits global song tempo during playback</Text>
      )}

      <Text style={styles.label}>Accent pattern</Text>
      <AccentBeatPreview beats={segment.accentPreview} />
      <View style={styles.chipRow}>
        {ACCENT_PRESET_OPTIONS.map((preset) => (
          <Pressable
            key={preset.id}
            style={styles.chip}
            onPress={() => onAccentChange(preset.id)}
          >
            <Text style={styles.chipText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: studioColors.overlay },
  sheet: {
    backgroundColor: studioColors.surfaceElevated,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '78%',
    borderTopWidth: 1,
    borderColor: studioColors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: studioColors.border,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '700', color: studioColors.textPrimary },
  subtitle: { fontSize: 13, color: studioColors.textSecondary, marginBottom: 12 },
  body: { maxHeight: 420 },
  label: {
    fontSize: 13,
    color: studioColors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: studioColors.textPrimary,
    backgroundColor: studioColors.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: studioColors.surface,
  },
  chipSelected: { backgroundColor: studioColors.accent, borderColor: studioColors.accent },
  chipText: { fontSize: 12, color: studioColors.textPrimary },
  chipTextSelected: { color: '#fff' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hint: { fontSize: 12, color: studioColors.textMuted, fontStyle: 'italic' },
  doneButton: {
    marginTop: 12,
    backgroundColor: studioColors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
