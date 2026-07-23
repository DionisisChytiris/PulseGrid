import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  /** Scroll this segment into view when the sheet opens (tapped region). */
  focusSegmentId?: string | null;
  onClose: () => void;
  onBarCountChange: (segmentId: string, count: number) => void;
  onMeterChange: (segmentId: string, meterLabel: string) => void;
  onAccentPatternChange: (segmentId: string, pattern: boolean[]) => void;
  /** Reserved for a future BPM-override row. */
  onBpmOverrideChange?: (segmentId: string, bpm: number | null) => void;
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

/**
 * Primary song-structure editor: scrollable list of inline segment rows.
 * CustomKeyboard docks below/beside the sheet; sheet height shrinks to stay visible.
 */
export function SegmentEditBottomSheet({
  visible,
  segments,
  focusSegmentId = null,
  onClose,
  onBarCountChange,
  onMeterChange,
  onAccentPatternChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const placement = resolvePlacement('auto', width, height);

  const scrollRef = useRef<ScrollView>(null);
  const rowLayouts = useRef(new Map<string, { y: number; height: number }>());
  const numeratorRefs = useRef(new Map<string, TextInput | null>());
  const barCountRefs = useRef(new Map<string, TextInput | null>());

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

  const defaultSheetHeight = Math.round(height * 0.78);
  const sheetHeight =
    keyboardOpen && placement === 'bottom'
      ? Math.max(Math.round(height * 0.4), height - bottomKeyboardHeight)
      : defaultSheetHeight;

  const panelMaxWidth = landscape
    ? Math.min(720, width - rightKeyboardWidth - 24)
    : width;

  const segmentIdsKey = useMemo(
    () => segments.map((segment) => segment.id).join('|'),
    [segments],
  );

  // Drop keyboard focus if the active segment disappeared after a merge/split.
  useEffect(() => {
    if (activeEdit === null) {
      return;
    }
    if (!segments.some((segment) => segment.id === activeEdit.segmentId)) {
      setActiveEdit(null);
    }
  }, [activeEdit, segments]);

  // Keep at most one expanded row; clear if that segment vanished.
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
    }
  }, [visible, focusSegmentId]);

  const scrollRowIntoView = useCallback(
    (segmentId: string) => {
      const layout = rowLayouts.current.get(segmentId);
      if (layout === undefined) {
        return;
      }
      scrollRef.current?.scrollTo({
        y: Math.max(0, layout.y - 8),
        animated: true,
      });
    },
    [],
  );

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
    const map = edit.kind === 'numerator' ? numeratorRefs : barCountRefs;
    requestAnimationFrame(() => {
      map.current.get(edit.segmentId)?.blur();
    });
  }, []);

  const commitEdit = useCallback(
    (current: ActiveEdit) => {
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

      const count = parseBarCountText(current.text) ?? clampBarCount(segment.numberOfBars);
      onBarCountChange(segment.id, count);
    },
    [onBarCountChange, onMeterChange, segments],
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

  const handleClose = () => {
    finalizeActiveEdit();
    onClose();
  };

  const handleToggleExpand = useCallback(
    (segmentId: string) => {
      setExpandedSegmentId((current) => {
        if (current === segmentId) {
          const edit = activeEditRef.current;
          if (edit !== null && edit.segmentId === segmentId) {
            commitEdit(edit);
            blurActiveInput(edit);
            setActiveEdit(null);
          }
          return null;
        }

        const edit = activeEditRef.current;
        if (edit !== null && edit.segmentId !== segmentId) {
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

      const nextText = sanitizeBarCountInput(text);
      const parsed = parseBarCountText(nextText);
      if (parsed !== null) {
        onBarCountChange(current.segmentId, parsed);
      }
      return { ...current, text: nextText };
    });
  };

  const displayNumerator = (segment: TimelineSegmentViewModel): string => {
    if (
      activeEdit?.segmentId === segment.id &&
      activeEdit.kind === 'numerator'
    ) {
      return activeEdit.text;
    }
    return String(meterNumerator(segment.meter));
  };

  const displayBarCount = (segment: TimelineSegmentViewModel): string => {
    if (
      activeEdit?.segmentId === segment.id &&
      activeEdit.kind === 'barCount'
    ) {
      return activeEdit.text;
    }
    return String(segment.numberOfBars);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      // RN Modal defaults to portrait-only on iOS — keep Song Editor landscape lock.
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.modalRoot}>
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

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {segments.map((segment) => (
              <SegmentEditorRow
                key={segment.id}
                segment={segment}
                expanded={expandedSegmentId === segment.id}
                numeratorText={displayNumerator(segment)}
                barCountText={displayBarCount(segment)}
                activeField={activeEdit}
                onToggleExpand={() => {
                  handleToggleExpand(segment.id);
                }}
                onNumeratorFocus={() => {
                  const previous = activeEditRef.current;
                  if (
                    previous !== null &&
                    (previous.segmentId !== segment.id || previous.kind !== 'numerator')
                  ) {
                    commitEdit(previous);
                    blurActiveInput(previous);
                  }
                  setActiveEdit({
                    segmentId: segment.id,
                    kind: 'numerator',
                    text: String(meterNumerator(segment.meter)),
                  });
                }}
                onBarCountFocus={() => {
                  const previous = activeEditRef.current;
                  if (
                    previous !== null &&
                    (previous.segmentId !== segment.id || previous.kind !== 'barCount')
                  ) {
                    commitEdit(previous);
                    blurActiveInput(previous);
                  }
                  setActiveEdit({
                    segmentId: segment.id,
                    kind: 'barCount',
                    text: String(segment.numberOfBars),
                  });
                }}
                onDenominatorChange={(denominator) => {
                  const numerator =
                    activeEdit?.segmentId === segment.id && activeEdit.kind === 'numerator'
                      ? parseNumeratorText(activeEdit.text) ?? meterNumerator(segment.meter)
                      : meterNumerator(segment.meter);
                  onMeterChange(segment.id, `${numerator}/${denominator}`);
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
    justifyContent: 'flex-end',
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
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  panelLandscape: {
    borderRadius: 16,
    marginBottom: 12,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 1,
  },
});
