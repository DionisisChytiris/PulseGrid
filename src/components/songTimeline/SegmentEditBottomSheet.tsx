import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
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
  MAX_SONG_BPM,
  MIN_SONG_BPM,
  parseSongBpmText,
  parseSongBpmTextLenient,
  sanitizeSongBpmInput,
} from '../../domain/music/songBpm';
import { sanitizeSongName, sanitizeSongNameInput } from '../../domain/music/songName';
import { AnalyticsService } from '../../services/AnalyticsService';
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
  initialSectionCreateMode,
  segmentHasEstablishedSection,
  type SectionCreateMode,
} from '../../presentation/components/songSignatureTimeline/sectionCreateMode';
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
import { TimelinePreparationSection } from '../../presentation/components/songSignatureTimeline/TimelinePreparationSection';
import type { TimelineSegmentViewModel } from '../../presentation/viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../presentation/theme';
import type { CountInBars } from '../../domain/music/countIn';

import { useBpmStepHold } from './useBpmStepHold';

/** @deprecated Preset chips removed — kept for any external imports. */
export const ACCENT_PRESET_OPTIONS = [
  { id: 'downbeat', label: 'Downbeat (▲ ○ ○ ○)' },
  { id: 'all', label: 'All beats (▲ ▲ ▲ ▲)' },
  { id: 'grouped-322', label: '7/8 grouped (▲ ○ ▲ ○ ▲ ○ ○)' },
] as const;

type Props = {
  visible: boolean;
  segments: readonly TimelineSegmentViewModel[];
  songName: string;
  songDefaultBpm: number;
  countInBars: CountInBars;
  /** Scroll this segment into view when the sheet opens (tapped region). */
  focusSegmentId?: string | null;
  /** Open song or segment tempo editing when launched from a Song Line marker. */
  focusTempoEdit?: 'song' | 'segment' | null;
  onClose: () => void;
  onSongDefaultBpmChange: (bpm: number) => void;
  onCountInBarsChange: (bars: CountInBars) => void;
  onBarCountChange: (segmentId: string, count: number) => void;
  onMeterChange: (segmentId: string, meterLabel: string) => void;
  onAccentPatternChange: (segmentId: string, pattern: boolean[]) => void;
  onBpmOverrideChange: (segmentId: string, bpm: number | null) => void;
  onDuplicateSegment: (segmentId: string) => string | null;
  onDeleteSegment: (segmentId: string) => string | null;
  onCreateSection: (segmentId: string, name: string) => void;
  onRemoveSection: (segmentId: string) => void;
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
  kind: 'numerator' | 'barCount' | 'segmentBpm' | 'sectionName',
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
  songName,
  songDefaultBpm,
  countInBars,
  focusSegmentId = null,
  focusTempoEdit = null,
  onClose,
  onSongDefaultBpmChange,
  onCountInBarsChange,
  onBarCountChange,
  onMeterChange,
  onAccentPatternChange,
  onBpmOverrideChange,
  onDuplicateSegment,
  onDeleteSegment,
  onCreateSection,
  onRemoveSection,
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
  const sectionNameRefs = useRef(new Map<string, TextInput | null>());
  const songBpmInputRef = useRef<TextInput | null>(null);
  const pendingSectionBarRef = useRef<number | null>(null);

  const [activeEdit, setActiveEdit] = useState<ActiveEdit | null>(null);
  const activeEditRef = useRef<ActiveEdit | null>(null);
  const bpmAtTypingStartRef = useRef<number | null>(null);
  activeEditRef.current = activeEdit;

  const [expandedSegmentId, setExpandedSegmentId] = useState<string | null>(null);
  const [pendingFocusSegmentId, setPendingFocusSegmentId] = useState<string | null>(null);
  const [sectionCreateMode, setSectionCreateMode] = useState<SectionCreateMode>('none');

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
    if (!visible) {
      setActiveEdit(null);
      setExpandedSegmentId(null);
      setPendingFocusSegmentId(null);
      setSectionCreateMode('none');
      rowLayouts.current.clear();
      return;
    }
    if (focusSegmentId !== null) {
      setExpandedSegmentId(focusSegmentId);
      const focused = segments.find((segment) => segment.id === focusSegmentId);
      setSectionCreateMode(
        focused === undefined ? 'none' : initialSectionCreateMode(focused),
      );
      return;
    }
    if (focusTempoEdit === 'song') {
      setExpandedSegmentId(null);
      setSectionCreateMode('none');
    }
    // Initialize from the focused bar when the sheet opens — do not re-sync on
    // every segment mutation while the editor stays open.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segments read once per open/focus
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
    if (pendingFocusSegmentId === null) {
      return;
    }
    const focused = segments.find((segment) => segment.id === pendingFocusSegmentId);
    if (focused === undefined) {
      return;
    }
    setExpandedSegmentId(pendingFocusSegmentId);
    setSectionCreateMode(initialSectionCreateMode(focused));
    setPendingFocusSegmentId(null);
    const focusId = pendingFocusSegmentId;
    const handle = requestAnimationFrame(() => {
      scrollRowIntoView(focusId);
    });
    return () => cancelAnimationFrame(handle);
  }, [pendingFocusSegmentId, segments, scrollRowIntoView]);

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
    if (pendingSectionBarRef.current === null) {
      return;
    }

    const globalBarIndex = pendingSectionBarRef.current;
    const target = segments.find(
      (segment) =>
        globalBarIndex >= segment.startBar - 1 && globalBarIndex <= segment.endBar - 1,
    );

    if (target === undefined) {
      return;
    }

    pendingSectionBarRef.current = null;
    setExpandedSegmentId(target.id);
    setSectionCreateMode('none');
    requestAnimationFrame(() => {
      scrollRowIntoView(target.id);
    });
  }, [segments, scrollRowIntoView]);

  useEffect(() => {
    if (expandedSegmentId === null) {
      return;
    }
    if (
      pendingFocusSegmentId === null &&
      pendingSectionBarRef.current === null &&
      !segments.some((segment) => segment.id === expandedSegmentId)
    ) {
      setExpandedSegmentId(null);
      return;
    }
    const handle = requestAnimationFrame(() => {
      scrollRowIntoView(expandedSegmentId);
    });
    return () => cancelAnimationFrame(handle);
  }, [expandedSegmentId, pendingFocusSegmentId, segments, sheetHeight, scrollRowIntoView]);

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
      if (edit.kind === 'sectionName') {
        sectionNameRefs.current.get(edit.segmentId)?.blur();
        return;
      }
      segmentBpmRefs.current.get(edit.segmentId)?.blur();
    });
  }, []);

  const commitEdit = useCallback(
    (current: ActiveEdit) => {
      if (current.kind === 'songBpm') {
        const bpm = parseSongBpmTextLenient(current.text) ?? safeSongBpm;
        if (
          bpmAtTypingStartRef.current !== null &&
          bpm !== bpmAtTypingStartRef.current
        ) {
          AnalyticsService.logTempoSet(bpm, 'typing');
        }
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

      if (current.kind === 'sectionName') {
        const trimmed = current.text.trim();
        if (trimmed.length === 0) {
          return;
        }
        onCreateSection(segment.id, sanitizeSongName(current.text));
        return;
      }

      const previousBpm =
        segment.bpmOverride !== null ? segment.bpmOverride : safeSongBpm;
      const bpm = parseSongBpmTextLenient(current.text) ?? previousBpm;
      if (
        bpmAtTypingStartRef.current !== null &&
        bpm !== bpmAtTypingStartRef.current
      ) {
        AnalyticsService.logTempoSet(bpm, 'typing');
      }
      onBpmOverrideChange(segment.id, bpm);
    },
    [
      onBarCountChange,
      onBpmOverrideChange,
      onCreateSection,
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
    if (current.kind === 'sectionName') {
      setSectionCreateMode('custom');
    }
  }, [blurActiveInput, commitEdit]);

  const beginEdit = useCallback(
    (next: ActiveEdit) => {
      const previous = activeEditRef.current;
      let continuing = false;
      if (previous !== null) {
        const sameSongBpm = previous.kind === 'songBpm' && next.kind === 'songBpm';
        const sameSegmentField =
          previous.kind !== 'songBpm' &&
          next.kind !== 'songBpm' &&
          previous.segmentId === next.segmentId &&
          previous.kind === next.kind;
        continuing = sameSongBpm || sameSegmentField;
        if (!continuing) {
          commitEdit(previous);
          blurActiveInput(previous);
        }
      }
      if (!continuing) {
        if (next.kind === 'songBpm') {
          bpmAtTypingStartRef.current = safeSongBpm;
        } else if (next.kind === 'segmentBpm') {
          const segment = segments.find((item) => item.id === next.segmentId);
          bpmAtTypingStartRef.current =
            segment?.bpmOverride !== null && segment !== undefined
              ? segment.bpmOverride
              : safeSongBpm;
        }
      }
      setActiveEdit(next);
    },
    [blurActiveInput, commitEdit, safeSongBpm, segments],
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
          setSectionCreateMode('none');
          return null;
        }

        const edit = activeEditRef.current;
        if (edit !== null && (edit.kind === 'songBpm' || edit.segmentId !== segmentId)) {
          commitEdit(edit);
          blurActiveInput(edit);
          setActiveEdit(null);
        }

        const segment = segments.find((item) => item.id === segmentId);
        setSectionCreateMode(
          segment === undefined ? 'none' : initialSectionCreateMode(segment),
        );
        return segmentId;
      });
    },
    [blurActiveInput, commitEdit, segments],
  );

  const handleDuplicateSegment = useCallback(
    (segmentId: string) => {
      finalizeActiveEdit();
      const focusId = onDuplicateSegment(segmentId);
      if (focusId !== null) {
        setPendingFocusSegmentId(focusId);
      }
    },
    [finalizeActiveEdit, onDuplicateSegment],
  );

  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      if (segments.length <= 1) {
        return;
      }

      Alert.alert(
        'Delete Segment?',
        'This will permanently remove this segment from the timeline.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              finalizeActiveEdit();
              const focusId = onDeleteSegment(segmentId);
              if (focusId !== null) {
                setPendingFocusSegmentId(focusId);
              }
            },
          },
        ],
      );
    },
    [finalizeActiveEdit, onDeleteSegment, segments.length],
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

      if (current.kind === 'sectionName') {
        return { ...current, text: sanitizeSongNameInput(text) };
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

  const displaySectionName = (segment: TimelineSegmentViewModel): string => {
    if (activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'sectionName')) {
      return activeEdit.text;
    }
    return '';
  };

  const displaySongBpm =
    activeEdit?.kind === 'songBpm' ? activeEdit.text : String(safeSongBpm);

  const songBpmFocused = activeEdit?.kind === 'songBpm';
  const atMinSongBpm = safeSongBpm <= MIN_SONG_BPM;
  const atMaxSongBpm = safeSongBpm >= MAX_SONG_BPM;

  const stepSongBpm = useCallback(
    (direction: 1 | -1) => {
      const edit = activeEditRef.current;
      const current =
        edit?.kind === 'songBpm'
          ? (parseSongBpmTextLenient(edit.text) ?? safeSongBpm)
          : safeSongBpm;
      const next = clampSongBpm(current + direction);
      onSongDefaultBpmChange(next);
      if (edit?.kind === 'songBpm') {
        setActiveEdit({ kind: 'songBpm', text: String(next) });
      }
    },
    [onSongDefaultBpmChange, safeSongBpm],
  );

  const { beginHold, endHold } = useBpmStepHold({ onStep: stepSongBpm });

  const discardSectionNameEdit = useCallback(() => {
    const edit = activeEditRef.current;
    if (edit === null || edit.kind !== 'sectionName') {
      return;
    }
    blurActiveInput(edit);
    setActiveEdit(null);
  }, [blurActiveInput]);

  const handleSectionCreateModeChange = useCallback(
    (mode: SectionCreateMode) => {
      const segment =
        expandedSegmentId === null
          ? undefined
          : segments.find((item) => item.id === expandedSegmentId);

      if (segment === undefined) {
        setSectionCreateMode(mode);
        return;
      }

      if (mode === 'none') {
        discardSectionNameEdit();
        if (segmentHasEstablishedSection(segment)) {
          pendingSectionBarRef.current = segment.startBar - 1;
          onRemoveSection(segment.id);
        }
        setSectionCreateMode('none');
        return;
      }

      if (mode !== 'custom') {
        discardSectionNameEdit();
      }

      setSectionCreateMode(mode);

      if (mode === 'custom' && !segmentHasEstablishedSection(segment)) {
        beginEdit({
          segmentId: segment.id,
          kind: 'sectionName',
          text: '',
        });
        requestAnimationFrame(() => {
          sectionNameRefs.current.get(segment.id)?.focus();
        });
      }
    },
    [beginEdit, discardSectionNameEdit, expandedSegmentId, onRemoveSection, segments],
  );

  const handleSectionPresetSelect = useCallback(
    (segmentId: string, name: string) => {
      discardSectionNameEdit();
      onCreateSection(segmentId, name);
      setSectionCreateMode('preset');
    },
    [discardSectionNameEdit, onCreateSection],
  );

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
            <View style={styles.headerSide}>
              <Text style={styles.songName} numberOfLines={1}>
                {songName.length > 0 ? songName : 'Untitled'}
              </Text>
            </View>

            <View style={styles.headerCenter}>
              <View style={styles.tempoControls}>
                <Pressable
                  onPressIn={() => {
                    if (!atMinSongBpm) {
                      beginHold(-1);
                    }
                  }}
                  onPressOut={endHold}
                  disabled={atMinSongBpm}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease timeline tempo"
                  style={({ pressed }) => [
                    styles.tempoStepButton,
                    atMinSongBpm && styles.tempoStepDisabled,
                    pressed && !atMinSongBpm && styles.tempoPressed,
                  ]}
                >
                  <Text style={[styles.tempoStepLabel, atMinSongBpm && styles.tempoStepLabelDisabled]}>
                    −
                  </Text>
                </Pressable>

                <TextInput
                  ref={songBpmInputRef}
                  style={[styles.songBpmInput, songBpmFocused && styles.inputFocused]}
                  value={displaySongBpm}
                  showSoftInputOnFocus={false}
                  caretHidden={!songBpmFocused}
                  disableFullscreenUI
                  selectTextOnFocus
                  maxLength={3}
                  accessibilityLabel="Timeline tempo BPM"
                  onFocus={() => {
                    beginEdit({ kind: 'songBpm', text: String(safeSongBpm) });
                  }}
                />

                <Pressable
                  onPressIn={() => {
                    if (!atMaxSongBpm) {
                      beginHold(1);
                    }
                  }}
                  onPressOut={endHold}
                  disabled={atMaxSongBpm}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Increase timeline tempo"
                  style={({ pressed }) => [
                    styles.tempoStepButton,
                    atMaxSongBpm && styles.tempoStepDisabled,
                    pressed && !atMaxSongBpm && styles.tempoPressed,
                  ]}
                >
                  <Text style={[styles.tempoStepLabel, atMaxSongBpm && styles.tempoStepLabelDisabled]}>
                    +
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={[styles.headerSide, styles.headerSideRight]}>
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
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            <TimelinePreparationSection
              countInBars={countInBars}
              onChange={onCountInBarsChange}
            />

            <Text style={styles.barsSectionTitle}>Bars</Text>

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
                onDuplicate={() => {
                  handleDuplicateSegment(segment.id);
                }}
                onDelete={
                  segments.length > 1
                    ? () => {
                        handleDeleteSegment(segment.id);
                      }
                    : undefined
                }
                canDelete={segments.length > 1}
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
                onRegisterSectionNameInput={(ref) => {
                  sectionNameRefs.current.set(segment.id, ref);
                }}
                onLayoutY={(y, rowHeight) => {
                  rowLayouts.current.set(segment.id, { y, height: rowHeight });
                }}
                sectionCreateMode={expandedSegmentId === segment.id ? sectionCreateMode : 'none'}
                sectionNameText={displaySectionName(segment)}
                onSectionCreateModeChange={handleSectionCreateModeChange}
                onSectionPresetSelect={(name) => {
                  handleSectionPresetSelect(segment.id, name);
                }}
                onSectionNameFocus={() => {
                  beginEdit({
                    segmentId: segment.id,
                    kind: 'sectionName',
                    text:
                      activeEdit !== null && isFieldForSegment(activeEdit, segment.id, 'sectionName')
                        ? activeEdit.text
                        : '',
                  });
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
          initialMode={activeEdit?.kind === 'sectionName' ? 'letters' : 'numbers'}
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
    minHeight: 40,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: studioColors.border,
    paddingBottom: 6,
  },
  headerSide: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    minWidth: 128,
  },
  songName: {
    fontSize: 16,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  tempoControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tempoStepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempoStepDisabled: {
    opacity: 0.35,
  },
  tempoStepLabel: {
    fontSize: 22,
    fontWeight: '400',
    color: studioColors.accent,
    lineHeight: 26,
  },
  tempoStepLabelDisabled: {
    color: studioColors.textMuted,
  },
  tempoPressed: {
    opacity: 0.7,
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
  songBpmInput: {
    minWidth: 44,
    maxWidth: 56,
    height: 32,
    paddingHorizontal: 2,
    paddingVertical: 0,
    color: studioColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  inputFocused: {
    color: studioColors.beatAccent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 1,
    gap: 8,
  },
  barsSectionTitle: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 15,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
});
