import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clampSongBpm,
  DEFAULT_SONG_BPM,
  parseSongBpmText,
  parseSongBpmTextLenient,
  sanitizeSongBpmInput,
} from '../../domain/music/songBpm';
import {
  CustomKeyboard,
  estimateCustomKeyboardBottomHeight,
  estimateCustomKeyboardRightWidth,
  resolvePlacement,
} from '../../presentation/components/CustomKeyboard';
import {
  SegmentEditorRow,
  type SegmentEditorActiveField,
} from '../../presentation/components/songSignatureTimeline/SegmentEditorRow';
import {
  clampBarCount,
  clampNumerator,
  normalizeDenominator,
  parseBarCountText,
  parseNumeratorText,
  sanitizeBarCountInput,
  sanitizeNumeratorInput,
  type MeterDenominator,
} from '../../presentation/components/songSignatureTimeline/meterPickerValidation';
import { overviewTempoMarkings } from '../../presentation/components/songSignatureTimeline/overviewTempoMarkings';
import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';

/** @deprecated Preset chips removed — kept for any external imports. */
export const ACCENT_PRESET_OPTIONS = [
  { id: 'downbeat', label: 'Downbeat (▲ ○ ○ ○)' },
  { id: 'all', label: 'All beats (▲ ▲ ▲ ▲)' },
  { id: 'grouped-322', label: '7/8 grouped (▲ ○ ▲ ○ ▲ ○ ○)' },
] as const;

type Props = {
  visible: boolean;
  segments: readonly TimelineSegmentViewModel[];
  songDefaultBpm: number;
  /** Scroll this segment into view when the sheet opens (tapped region). */
  focusSegmentId?: string | null;
  /** Open song or segment tempo editing when launched from a Song Line marker. */
  focusTempoEdit?: 'song' | 'segment' | null;
  onClose: () => void;
  onSongDefaultBpmChange: (bpm: number) => void;
  onBarCountChange: (segmentId: string, count: number) => void;
  onMeterChange: (segmentId: string, meterLabel: string) => void;
  onAccentPatternChange: (segmentId: string, pattern: boolean[]) => void;
  onBpmOverrideChange: (segmentId: string, bpm: number | null) => void;
};

type ActiveEdit = SegmentEditorActiveField & { text: string };

function meterNumerator(meterLabel: string): number {
  const numerator = Number(meterLabel.split('/')[0]);
  return Number.isInteger(numerator) ? clampNumerator(numerator) : 4;
}

function meterDenominator(meterLabel: string): MeterDenominator {
  const denominator = Number(meterLabel.split('/')[1]);
  return normalizeDenominator(Number.isInteger(denominator) ? denominator : 4);
}

function isFieldForSegment(
  edit: ActiveEdit,
  segmentId: string,
  kind: 'numerator' | 'barCount' | 'segmentBpm',
): boolean {
  return (
    edit.kind === kind && 'segmentId' in edit && edit.segmentId === segmentId
  );
}

/**
 * Primary song-structure editor: song tempo + scrollable segment rows.
 * CustomKeyboard docks below/beside the sheet; sheet height shrinks to stay visible.
 */
export function SegmentEditBottomSheet({
  visible,
  segments,
  songDefaultBpm,
  focusSegmentId = null,
  focusTempoEdit = null,
  onClose,
  onSongDefaultBpmChange,
  onBarCountChange,
  onMeterChange,
  onAccentPatternChange,
  onBpmOverrideChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const placement = resolvePlacement('auto', width, height);

  const scrollRef = useRef<ScrollView>(null);
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const numeratorRefs = useRef(new Map<string, TextInput | null>());
  const barCountRefs = useRef(new Map<string, TextInput | null>());
  const segmentBpmRefs = useRef(new Map<string, TextInput | null>());
  const songBpmInputRef = useRef<TextInput | null>(null);

  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const activeEditRef = useRef<ActiveEdit | null>(null);
  activeEditRef.current = activeEdit;

  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(null);

  const keyboardOpen = activeEdit !== null;
  const bottomKeyboardHeight =
    keyboardOpen && placement === 'bottom'
      ? estimateCustomKeyboardBottomHeight(insets.bottom)
      : 0;
  const rightKeyboardWidth =
    keyboardOpen && placement === 'right' ? estimateCustomKeyboardRightWidth(width) : 0;

  const edgeMargin = 16;
  const defaultSheetHeight = Math.max(240, height - edgeMargin * 2);
  const sheetHeight =
    keyboardOpen && placement === 'bottom'
      ? Math.max(Math.round(height * 0.4), height - bottomKeyboardHeight - edgeMargin)
      : defaultSheetHeight;

  const panelMaxWidth = landscape
    ? Math.min(720, width - rightKeyboardWidth - edgeMargin * 2)
    : width;

  const segmentIdsKey = useMemo(
    () => segments.map((segment) => segment.id).join('|'),
    [segments],
  );

  const safeSongBpm = Number.isFinite(songDefaultBpm)
    ? clampSongBpm(songDefaultBpm)
    : DEFAULT_SONG_BPM;

  const tempoMarkings = useMemo(
    () => overviewTempoMarkings(segments, safeSongBpm),
    [segments, safeSongBpm],
  );

  useEffect(() => {
    if (activeEdit === null) {
      return;
    }
    if (activeEdit.kind === 'songBpm') {
      return;
    }
    if (!segments.some((segment) => segment.id === activeEdit.segmentId)) {
      setActiveEdit(null);
    }
  }, [activeEdit, segments]);

  useEffect(() => {
    if (expandedSegmentId === null) {
      return;
    }
    if (!segments.some((segment) => segment.id === expandedSegmentId)) {
      setExpandedSegmentId(null);
    }
  }, [expandedSegmentId, segments]);

  useEffect(() => {
    if (!visible) {
      setActiveEdit(null);
      setExpandedSegmentId(null);
      rowLayouts.current.clear();
      return;
    }
    if (focusSegmentId !== null) {
      setExpandedSegmentId(focusSegmentId);
      return;
    }
    if (focusTempoEdit === 'song') {
      setExpandedSegmentId(null);
    }
  }, [visible, focusSegmentId, focusTempoEdit]);

  const scrollRowIntoView = useCallback((segmentId: string) => {
    const layout = rowLayouts.current.get(segmentId);
    if (layout === undefined) {
      return;
    }
    scrollRef.current?.scrollTo({
      y: Math.max(0, layout.y - 8),
      animated: true,
    });
  }, []);

  useEffect(() => {
    if (!visible || focusSegmentId === null) {
      return;
    }
    const handle = requestAnimationFrame(() => {
      scrollRowIntoView(focusSegmentId);
    });
    return () => cancelAnimationFrame(handle);
  }, [visible, focusSegmentId, segmentIdsKey, scrollRowIntoView]);

  useEffect(() => {
    if (expandedSegmentId === null) {
      return;
    }
    const handle = requestAnimationFrame(() => {
      scrollRowIntoView(expandedSegmentId);
    });
    return () => cancelAnimationFrame(handle);
  }, [expandedSegmentId, sheetHeight, scrollRowIntoView]);

  const blurActiveInput = useCallback((edit: ActiveEdit | null) => {
    if (edit === null) {
      return;
    }
    requestAnimationFrame(() => {
      if (edit.kind === 'songBpm') {
        songBpmInputRef.current?.blur();
        return;
      }
      if (edit.kind === 'numerator') {
        numeratorRefs.current.get(edit.segmentId)?.blur();
        return;
      }
      if (edit.kind === 'barCount') {
        barCountRefs.current.get(edit.segmentId)?.blur();
        return;
      }
      segmentBpmRefs.current.get(edit.segmentId)?.blur();
    });
  }, []);

  const commitEdit = useCallback(
    (current: ActiveEdit) => {
      if (current.kind === 'songBpm') {
        const bpm = parseSongBpmTextLenient(current.text) ?? safeSongBpm;
        onSongDefaultBpmChange(bpm);
        return;
      }

      const segment = segments.find((item) => item.id === current.segmentId);
      if (segment === undefined) {
        return;
      }

      if (current.kind === 'numerator') {
        const numerator = parseNumeratorText(current.text) ?? meterNumerator(segment.meter);
        const denominator = meterDenominator(segment.meter);
        onMeterChange(segment.id, `${numerator}/${denominator}`);
        return;
      }

      if (current.kind === 'barCount') {
        const count = parseBarCountText(current.text) ?? clampBarCount(segment.numberOfBars);
        onBarCountChange(segment.id, count);
        return;
      }

      const bpm =
        parseSongBpmTextLenient(current.text) ??
        (segment.bpmOverride !== null ? segment.bpmOverride : safeSongBpm);
      onBpmOverrideChange(segment.id, bpm);
    },
    [
      onBarCountChange,
      onBpmOverrideChange,
      onMeterChange,
      onSongDefaultBpmChange,
      safeSongBpm,
      segments,
    ],
  );

  const finalizeActiveEdit = useCallback(() => {
    const current = activeEditRef.current;
    if (current === null) {
      return;
    }
    commitEdit(current);
    blurActiveInput(current);
    setActiveEdit(null);
  }, [blurActiveInput, commitEdit]);

  const beginEdit = useCallback(
    (next: ActiveEdit) => {
      const previous = activeEditRef.current;
      if (previous !== null) {
        const sameSongBpm = previous.kind === 'songBpm' && next.kind === 'songBpm';
        const sameSegmentField =
          previous.kind !== 'songBpm' &&
          next.kind !== 'songBpm' &&
          previous.segmentId === next.segmentId &&
          previous.kind === next.kind;
        if (!sameSongBpm && !sameSegmentField) {
          commitEdit(previous);
          blurActiveInput(previous);
        }
      }
      setActiveEdit(next);
    },
    [blurActiveInput, commitEdit],
  );

  useEffect(() => {
    if (!visible || focusTempoEdit === null) {
      return;
    }

    const handle = requestAnimationFrame(() => {
      if (focusTempoEdit === 'song') {
        beginEdit({ kind: 'songBpm', text: String(safeSongBpm) });
        songBpmInputRef.current?.focus();
        return;
      }

      if (focusSegmentId === null) {
        return;
      }

      const segment = segments.find((item) => item.id === focusSegmentId);
      if (segment === undefined) {
        return;
      }

      if (segment.bpmOverride !== null) {
        beginEdit({
          segmentId: segment.id,
          kind: 'segmentBpm',
          text: String(segment.bpmOverride),
        });
        segmentBpmRefs.current.get(segment.id)?.focus();
      }
    });

    return () => cancelAnimationFrame(handle);
    // Open-once when launched from a Song Line tempo marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-focusing while typing BPM
  }, [visible, focusTempoEdit, focusSegmentId, beginEdit]);

  const handleClose = () => {
    finalizeActiveEdit();
    onClose();
  };

  const handleToggleExpand = useCallback(
    (segmentId: string) => {
      setExpandedSegmentId((current) => {
        if (current === segmentId) {
          const edit = activeEditRef.current;
          if (edit !== null && edit.kind !== 'songBpm' && edit.segmentId === segmentId) {
            commitEdit(edit);
            blurActiveInput(edit);
            setActiveEdit(null);
          }
          return null;
        }

        const edit = activeEditRef.current;
        if (edit !== null && (edit.kind === 'songBpm' || edit.segmentId !== segmentId)) {
          commitEdit(edit);
          blurActiveInput(edit);
          setActiveEdit(null);
        }
        return segmentId;
      });
    },
    [blurActiveInput, commitEdit],
  );

  const handleKeyboardChange = (text: string) => {
    setActiveEdit((current) => {
      if (current === null) {
        return current;
      }

      if (current.kind === 'numerator') {
        const nextText = sanitizeNumeratorInput(text);
        const parsed = parseNumeratorText(nextText);
        if (parsed !== null) {
          const segment = segments.find((item) => item.id === current.segmentId);
          if (segment !== undefined) {
            const denominator = meterDenominator(segment.meter);
            onMeterChange(segment.id, `${parsed}/${denominator}`);
          }
        }
        return { ...current, text: nextText };
      }

      if (current.kind === 'barCount') {
        const nextText = sanitizeBarCountInput(text);
        const parsed = parseBarCountText(nextText);
        if (parsed !== null) {
          onBarCountChange(current.segmentId, parsed);
        }
        return { ...current, text: nextText };
      }

      const nextText = sanitizeSongBpmInput(text);
      const parsed = parseSongBpmText(nextText);
      if (parsed !== null) {
        if (current.kind === 'songBpm') {
          onSongDefaultBpmChange(parsed);
        } else {
          onBpmOverrideChange(current.segmentId, parsed);
        }
      }
      return { ...current, text: nextText };
    });
  };

  const displayNumerator = (segment: TimelineSegmentViewModel): string => {
    if (activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'numerator')) {
      return activeEdit.text;
    }
    return String(meterNumerator(segment.meter));
  };

  const displayBarCount = (segment: TimelineSegmentViewModel): string => {
    if (activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'barCount')) {
      return activeEdit.text;
    }
    return String(segment.numberOfBars);
  };

  const displaySegmentBpm = (segment: TimelineSegmentViewModel): string => {
    if (activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'segmentBpm')) {
      return activeEdit.text;
    }
    return String(segment.bpmOverride ?? safeSongBpm);
  };

  const displaySongBpm =
    activeEdit?.kind === 'songBpm' ? activeEdit.text : String(safeSongBpm);

  const songBpmFocused = activeEdit?.kind === 'songBpm';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      // RN Modal defaults to portrait-only on iOS — keep Song Editor landscape lock.
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={[styles.modalRoot, { paddingVertical: edgeMargin }]}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Dismiss" />

        <View
          style={[
            styles.panel,
            landscape ? styles.panelLandscape : styles.panelPortrait,
            {
              height: sheetHeight,
              maxWidth: panelMaxWidth,
              width: '100%',
              marginRight: rightKeyboardWidth > 0 ? rightKeyboardWidth : 0,
              paddingBottom: keyboardOpen && placement === 'bottom' ? 8 : Math.max(insets.bottom, 12),
              paddingLeft: Math.max(insets.left, 16),
              paddingRight: Math.max(insets.right, 16),
            },
          ]}
        >
          {!landscape ? <View style={styles.handle} /> : null}

          <View style={styles.header}>
            <Text style={styles.title}>Edit Segment</Text>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Done"
              style={({ pressed }) => [styles.doneButton, pressed && styles.donePressed]}
            >
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.songTempoRow}>
            <Text style={styles.songTempoLabel}>Song Tempo</Text>
            <View style={styles.songTempoValue}>
              <TextInput
                ref={songBpmInputRef}
                style={[styles.songBpmInput, songBpmFocused && styles.inputFocused]}
                value={displaySongBpm}
                showSoftInputOnFocus={false}
                caretHidden={!songBpmFocused}
                disableFullscreenUI
                selectTextOnFocus
                maxLength={3}
                accessibilityLabel="Song tempo BPM"
                onFocus={() => {
                  beginEdit({ kind: 'songBpm', text: String(safeSongBpm) });
                }}
              />
              <Text style={styles.songBpmUnit}>BPM</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {segments.map((segment, index) => (
              <SegmentEditorRow
                key={segment.id}
                segment={segment}
                expanded={expandedSegmentId === segment.id}
                songDefaultBpm={safeSongBpm}
                overviewTempoBpm={tempoMarkings[index] ?? null}
                numeratorText={displayNumerator(segment)}
                barCountText={displayBarCount(segment)}
                segmentBpmText={displaySegmentBpm(segment)}
                activeField={activeEdit}
                onToggleExpand={() => {
                  handleToggleExpand(segment.id);
                }}
                onNumeratorFocus={() => {
                  beginEdit({
                    segmentId: segment.id,
                    kind: 'numerator',
                    text: String(meterNumerator(segment.meter)),
                  });
                }}
                onBarCountFocus={() => {
                  beginEdit({
                    segmentId: segment.id,
                    kind: 'barCount',
                    text: String(segment.numberOfBars),
                  });
                }}
                onSegmentBpmFocus={() => {
                  beginEdit({
                    segmentId: segment.id,
                    kind: 'segmentBpm',
                    text: String(segment.bpmOverride ?? safeSongBpm),
                  });
                }}
                onDenominatorChange={(denominator) => {
                  const numerator =
                    activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'numerator')
                      ? parseNumeratorText(activeEdit.text) ?? meterNumerator(segment.meter)
                      : meterNumerator(segment.meter);
                  onMeterChange(segment.id, `${numerator}/${denominator}`);
                }}
                onUseSongTempoChange={(useSongTempo) => {
                  if (useSongTempo) {
                    onBpmOverrideChange(segment.id, null);
                    return;
                  }
                  onBpmOverrideChange(segment.id, safeSongBpm);
                }}
                onAccentPatternChange={(pattern) => {
                  onAccentPatternChange(segment.id, pattern);
                }}
                onRegisterNumeratorInput={(ref) => {
                  numeratorRefs.current.set(segment.id, ref);
                }}
                onRegisterBarCountInput={(ref) => {
                  barCountRefs.current.set(segment.id, ref);
                }}
                onRegisterSegmentBpmInput={(ref) => {
                  segmentBpmRefs.current.set(segment.id, ref);
                }}
                onLayoutY={(y, rowHeight) => {
                  rowLayouts.current.set(segment.id, { y, height: rowHeight });
                }}
              />
            ))}
          </ScrollView>
        </View>

        <CustomKeyboard
          visible={keyboardOpen}
          value={activeEdit?.text ?? ''}
          onChangeText={handleKeyboardChange}
          onDone={finalizeActiveEdit}
          placement="auto"
          initialMode="numbers"
        />
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  panel: {
    backgroundColor: studioColors.surface,
    borderColor: studioColors.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    zIndex: 2,
  },
  panelPortrait: {
    borderRadius: 16,
  },
  panelLandscape: {
    borderRadius: 16,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: studioColors.border,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  doneButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  donePressed: {
    opacity: 0.65,
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: studioColors.accent,
  },
  songTempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: studioColors.border,
  },
  songTempoLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  songTempoValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  songBpmInput: {
    width: 64,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  inputFocused: {
    borderColor: studioColors.accent,
  },
  songBpmUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
});
