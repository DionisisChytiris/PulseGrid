import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomKeyboard } from '../../presentation/components/CustomKeyboard';
import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

import { AccentBeatPreview } from './AccentBeatPreview';

export const ACCENT_PRESET_OPTIONS = [
  { id: 'downbeat', label: 'Downbeat (▲ ○ ○ ○)' },
  { id: 'all', label: 'All beats (▲ ▲ ▲ ▲)' },
  { id: 'grouped-322', label: '7/8 grouped (▲ ○ ▲ ○ ▲ ○ ○)' },
] as const;

type CustomMeterKeyboardProps = {
  active: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onFocus: (currentValue: string) => void;
  onDone: () => void;
  onRegister?: (ref: TextInput | null) => void;
};

type Props = {
  visible: boolean;
  segment: TimelineSegmentViewModel | null;
  meterOptions: readonly string[];
  onClose: () => void;
  onBarCountChange: (count: number) => void;
  onMeterChange: (meterLabel: string) => void;
  onBpmOverrideChange: (bpm: number | null) => void;
  onAccentChange: (presetId: string) => void;
  /** Optional CustomKeyboard binding for the time-signature field. */
  meterKeyboard?: CustomMeterKeyboardProps;
};

/**
 * Large landscape-friendly editor for a timeline meter region.
 * Modal UI only — does not affect playback or timeline rendering.
 */
export function SegmentEditBottomSheet({
  visible,
  segment,
  meterOptions,
  onClose,
  onBarCountChange,
  onMeterChange,
  onBpmOverrideChange,
  onAccentChange,
  meterKeyboard,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const keyboardOpen = meterKeyboard?.active === true;

  if (segment === null) {
    return null;
  }

  const panelMaxWidth = landscape
    ? Math.min(640, width * (keyboardOpen ? 0.5 : 0.92))
    : width;
  const panelMaxHeight = landscape
    ? height - insets.top - insets.bottom - 24
    : keyboardOpen
      ? height * 0.5
      : height * 0.88;

  const handleClose = () => {
    if (meterKeyboard?.active) {
      meterKeyboard.onDone();
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Dismiss" />
        <View
          style={[
            styles.panel,
            landscape ? styles.panelLandscape : styles.panelPortrait,
            {
              maxWidth: panelMaxWidth,
              maxHeight: panelMaxHeight,
              marginRight: landscape && keyboardOpen ? width * 0.45 : 0,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              paddingLeft: Math.max(insets.left, 20),
              paddingRight: Math.max(insets.right, 20),
            },
          ]}
        >
          {!landscape ? <View style={styles.handle} /> : null}
          <Text style={styles.title}>Edit Segment</Text>
          <Text style={styles.subtitle}>
            {segment.meter} ·{' '}
            {segment.startBar === segment.endBar
              ? `Bar ${segment.startBar}`
              : `Bars ${segment.startBar}–${segment.endBar}`}
          </Text>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SegmentEditorFields
              segment={segment}
              meterOptions={meterOptions}
              onBarCountChange={onBarCountChange}
              onMeterChange={onMeterChange}
              onBpmOverrideChange={onBpmOverrideChange}
              onAccentChange={onAccentChange}
              meterKeyboard={meterKeyboard}
            />
          </ScrollView>

          <Pressable style={styles.doneButton} onPress={handleClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>

        {meterKeyboard !== undefined ? (
          <CustomKeyboard
            visible={meterKeyboard.active}
            value={meterKeyboard.value}
            onChangeText={meterKeyboard.onChangeText}
            onDone={() => {
              const next = meterKeyboard.value.trim();
              if (/^\d+\/\d+$/.test(next)) {
                onMeterChange(next);
              }
              meterKeyboard.onDone();
            }}
            placement="auto"
            initialMode="numbers"
          />
        ) : null}
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
  meterKeyboard,
}: {
  segment: TimelineSegmentViewModel;
  meterOptions: readonly string[];
  onBarCountChange: (count: number) => void;
  onMeterChange: (meterLabel: string) => void;
  onBpmOverrideChange: (bpm: number | null) => void;
  onAccentChange: (presetId: string) => void;
  meterKeyboard?: CustomMeterKeyboardProps;
}) {
  const meterInputRef = useRef<TextInput>(null);
  const [barCountText, setBarCountText] = useState(String(segment.numberOfBars));
  const [bpmEnabled, setBpmEnabled] = useState(segment.bpmOverride !== null);
  const [bpmText, setBpmText] = useState(
    segment.bpmOverride !== null ? String(segment.bpmOverride) : '',
  );
  const [localMeter, setLocalMeter] = useState(segment.meter);

  useEffect(() => {
    setBarCountText(String(segment.numberOfBars));
    setBpmEnabled(segment.bpmOverride !== null);
    setBpmText(segment.bpmOverride !== null ? String(segment.bpmOverride) : '');
    setLocalMeter(segment.meter);
  }, [segment.bpmOverride, segment.meter, segment.numberOfBars]);

  useEffect(() => {
    if (meterKeyboard?.active !== true) {
      meterInputRef.current?.blur();
    }
  }, [meterKeyboard?.active]);

  const meterValue =
    meterKeyboard?.active === true ? meterKeyboard.value : localMeter;

  return (
    <>
      <Text style={styles.label}>Bars in segment</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={barCountText}
        placeholderTextColor={studioColors.textMuted}
        disableFullscreenUI
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
      <TextInput
        ref={(ref) => {
          meterInputRef.current = ref;
          meterKeyboard?.onRegister?.(ref);
        }}
        style={[styles.input, meterKeyboard?.active === true && styles.inputFocused]}
        value={meterValue}
        placeholder="e.g. 7/8"
        placeholderTextColor={studioColors.textMuted}
        showSoftInputOnFocus={false}
        caretHidden={meterKeyboard?.active !== true}
        disableFullscreenUI
        onFocus={() => {
          meterKeyboard?.onFocus(localMeter);
        }}
        onChangeText={(text) => {
          setLocalMeter(text);
          if (meterKeyboard?.active) {
            meterKeyboard.onChangeText(text);
          }
        }}
      />
      <View style={styles.chipRow}>
        {meterOptions.map((meter) => (
          <Pressable
            key={meter}
            style={[styles.chip, meter === meterValue && styles.chipSelected]}
            onPress={() => {
              setLocalMeter(meter);
              onMeterChange(meter);
              if (meterKeyboard?.active) {
                meterKeyboard.onChangeText(meter);
              }
            }}
          >
            <Text style={[styles.chipText, meter === meterValue && styles.chipTextSelected]}>
              {meter}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.labelInline}>BPM override (metadata)</Text>
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
          disableFullscreenUI
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
    width: '100%',
    backgroundColor: studioColors.surfaceElevated,
    borderColor: studioColors.border,
    paddingTop: 16,
    zIndex: 1,
  },
  panelPortrait: {
    marginTop: 'auto',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
  },
  panelLandscape: {
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 320,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: studioColors.border,
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: studioColors.textPrimary },
  subtitle: { fontSize: 14, color: studioColors.textSecondary, marginTop: 4, marginBottom: 8 },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingBottom: 8 },
  label: {
    fontSize: 14,
    color: studioColors.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    fontWeight: '600',
  },
  labelInline: {
    fontSize: 14,
    color: studioColors.textSecondary,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 18,
    color: studioColors.textPrimary,
    backgroundColor: studioColors.surface,
  },
  inputFocused: {
    borderColor: studioColors.accent,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  chip: {
    borderWidth: 1,
    borderColor: studioColors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: studioColors.surface,
  },
  chipSelected: { backgroundColor: studioColors.accent, borderColor: studioColors.accent },
  chipText: { fontSize: 14, color: studioColors.textPrimary, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 4,
  },
  hint: { fontSize: 13, color: studioColors.textMuted, fontStyle: 'italic', marginTop: 6 },
  doneButton: {
    marginTop: 16,
    backgroundColor: studioColors.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: { color: '#fff', fontWeight: '700', fontSize: 17 },
});
