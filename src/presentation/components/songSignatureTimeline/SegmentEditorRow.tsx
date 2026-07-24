import { memo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from 'react-native';

import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';
import { AccentPatternToggleRow } from '../metronome/AccentPatternToggleRow';

import {
  METER_DENOMINATORS,
  normalizeDenominator,
  type MeterDenominator,
} from './meterPickerValidation';
import { InlineTempoMarking } from './InlineTempoMarking';

export type SegmentEditorActiveField =
  | { segmentId: string; kind: 'numerator' }
  | { segmentId: string; kind: 'barCount' }
  | { segmentId: string; kind: 'segmentBpm' }
  | { kind: 'songBpm' };

type Props = {
  segment: TimelineSegmentViewModel;
  expanded: boolean;
  songDefaultBpm: number;
  /** Effective BPM to show in overview, or null when unchanged from previous segment. */
  overviewTempoBpm: number | null;
  numeratorText: string;
  barCountText: string;
  segmentBpmText: string;
  activeField: SegmentEditorActiveField | null;
  onToggleExpand: () => void;
  onNumeratorFocus: () => void;
  onBarCountFocus: () => void;
  onSegmentBpmFocus: () => void;
  onDenominatorChange: (denominator: MeterDenominator) => void;
  onUseSongTempoChange: (useSongTempo: boolean) => void;
  onAccentPatternChange: (pattern: boolean[]) => void;
  onRegisterNumeratorInput: (ref: TextInputType | null) => void;
  onRegisterBarCountInput: (ref: TextInputType | null) => void;
  onRegisterSegmentBpmInput: (ref: TextInputType | null) => void;
  onLayoutY: (y: number, height: number) => void;
};

function barsRangeLabel(startBar: number, endBar: number): string {
  return startBar === endBar ? `Bars ${startBar}` : `Bars ${startBar}–${endBar}`;
}

function accentFlagsFromSegment(segment: TimelineSegmentViewModel): boolean[] {
  return segment.accentPreview.map((beat) => beat.symbol === 'accent');
}

function parseDenominatorFromMeter(meterLabel: string): MeterDenominator {
  const denom = Number(meterLabel.split('/')[1]);
  return normalizeDenominator(Number.isInteger(denom) ? denom : 4);
}

/**
 * Percentage-column overview (Bars | Meter | Tempo | Count | Accents)
 * plus expanded meter / bar-count / tempo editors.
 */
export const SegmentEditorRow = memo(function SegmentEditorRow({
  segment,
  expanded,
  songDefaultBpm,
  overviewTempoBpm,
  numeratorText,
  barCountText,
  segmentBpmText,
  activeField,
  onToggleExpand,
  onNumeratorFocus,
  onBarCountFocus,
  onSegmentBpmFocus,
  onDenominatorChange,
  onUseSongTempoChange,
  onAccentPatternChange,
  onRegisterNumeratorInput,
  onRegisterBarCountInput,
  onRegisterSegmentBpmInput,
  onLayoutY,
}: Props) {
  const numeratorFocused =
    activeField?.kind === 'numerator' &&
    'segmentId' in activeField &&
    activeField.segmentId === segment.id;
  const barCountFocused =
    activeField?.kind === 'barCount' &&
    'segmentId' in activeField &&
    activeField.segmentId === segment.id;
  const segmentBpmFocused =
    activeField?.kind === 'segmentBpm' &&
    'segmentId' in activeField &&
    activeField.segmentId === segment.id;
  const denominator = parseDenominatorFromMeter(segment.meter);
  const accentPattern = accentFlagsFromSegment(segment);
  const rangeLabel = barsRangeLabel(segment.startBar, segment.endBar);
  const useSongTempo = segment.bpmOverride === null;

  return (
    <View
      style={[styles.root, expanded && styles.rootSelected]}
      onLayout={(event) => {
        const { y, height } = event.nativeEvent.layout;
        onLayoutY(y, height);
      }}
      accessibilityLabel={`Segment ${segment.meter}, ${rangeLabel}`}
      accessibilityState={{ expanded, selected: expanded }}
    >
      <View style={styles.tableRow}>
        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} segment ${rangeLabel}`}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [styles.colBars, pressed && styles.colPressed]}
        >
          <Text style={styles.cellBars} numberOfLines={1}>
            {rangeLabel}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={`Time signature ${segment.meter}`}
          style={({ pressed }) => [styles.colMeter, pressed && styles.colPressed]}
        >
          <Text style={styles.cellMeter} numberOfLines={1}>
            {segment.meter}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={
            overviewTempoBpm === null
              ? 'Tempo unchanged from previous segment'
              : `Tempo ${overviewTempoBpm} BPM`
          }
          style={({ pressed }) => [styles.colTempo, pressed && styles.colPressed]}
        >
          {overviewTempoBpm !== null ? (
            <InlineTempoMarking bpm={overviewTempoBpm} leadingSpace={false} />
          ) : (
            <View style={styles.tempoSpacer} />
          )}
        </Pressable>

        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={`Bar count ${segment.numberOfBars}`}
          style={({ pressed }) => [styles.colCount, pressed && styles.colPressed]}
        >
          <Text style={styles.cellCount} numberOfLines={1}>
            ×{segment.numberOfBars}
          </Text>
        </Pressable>

        <View style={styles.colAccents}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.accentScrollContent}
          >
            <AccentPatternToggleRow
              pattern={accentPattern}
              onChange={onAccentPatternChange}
              size={12}
              gap={4}
              minTouchSize={32}
            />
          </ScrollView>
        </View>
      </View>

      {expanded ? (
        <View style={styles.editorBlock}>
          <View style={styles.editorRow}>
            <View style={styles.meterGroup}>
              <TextInput
                ref={onRegisterNumeratorInput}
                style={[styles.numeratorInput, numeratorFocused && styles.inputFocused]}
                value={numeratorText}
                showSoftInputOnFocus={false}
                caretHidden={!numeratorFocused}
                disableFullscreenUI
                selectTextOnFocus
                maxLength={2}
                accessibilityLabel="Beats per bar"
                onFocus={onNumeratorFocus}
              />

              <Text style={styles.slash}>/</Text>

              <View style={styles.denominatorRow}>
                {METER_DENOMINATORS.map((value) => {
                  const selected = value === denominator;
                  return (
                    <Pressable
                      key={value}
                      style={[styles.denomChip, selected && styles.denomChipSelected]}
                      onPress={() => onDenominatorChange(value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Denominator ${value}`}
                    >
                      <Text style={[styles.denomText, selected && styles.denomTextSelected]}>
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.barCountGroup}>
              <Text style={styles.multiply}>×</Text>
              <TextInput
                ref={onRegisterBarCountInput}
                style={[styles.barCountInput, barCountFocused && styles.inputFocused]}
                value={barCountText}
                showSoftInputOnFocus={false}
                caretHidden={!barCountFocused}
                disableFullscreenUI
                selectTextOnFocus
                maxLength={2}
                accessibilityLabel="Number of bars"
                onFocus={onBarCountFocus}
              />
            </View>
          </View>

          <View style={styles.tempoBlock}>
            <Text style={styles.tempoTitle}>Tempo</Text>
            <Pressable
              onPress={() => onUseSongTempoChange(!useSongTempo)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useSongTempo }}
              accessibilityLabel={
                useSongTempo
                  ? `Use song tempo ${songDefaultBpm} BPM`
                  : 'Use song tempo'
              }
              style={styles.tempoCheckRow}
            >
              <View style={[styles.checkbox, useSongTempo && styles.checkboxChecked]}>
                {useSongTempo ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.tempoCheckLabel}>
                {useSongTempo
                  ? `Use Song Tempo (${songDefaultBpm} BPM)`
                  : 'Use Song Tempo'}
              </Text>
            </Pressable>

            <View style={[styles.segmentBpmRow, useSongTempo && styles.segmentBpmRowDisabled]}>
              <Text style={[styles.bpmLabel, useSongTempo && styles.bpmLabelDisabled]}>BPM:</Text>
              <TextInput
                ref={onRegisterSegmentBpmInput}
                style={[
                  styles.segmentBpmInput,
                  segmentBpmFocused && styles.inputFocused,
                  useSongTempo && styles.segmentBpmInputDisabled,
                ]}
                value={useSongTempo ? String(songDefaultBpm) : segmentBpmText}
                editable={!useSongTempo}
                showSoftInputOnFocus={false}
                caretHidden={!segmentBpmFocused}
                disableFullscreenUI
                selectTextOnFocus
                maxLength={3}
                accessibilityLabel="Segment BPM override"
                accessibilityState={{ disabled: useSongTempo }}
                onFocus={() => {
                  if (!useSongTempo) {
                    onSegmentBpmFocus();
                  }
                }}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: studioColors.border,
    borderRadius: 8,
  },
  rootSelected: {
    backgroundColor: studioColors.accentMutedBg,
    borderBottomColor: studioColors.accent,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    width: '100%',
  },
  colBars: {
    width: 96,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colMeter: {
    width: 52,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colTempo: {
    width: 88,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colCount: {
    width: 48,
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colAccents: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 0,
  },
  colPressed: {
    opacity: 0.7,
  },
  cellBars: {
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    color: studioColors.textSecondary,
    textAlign: 'left',
  },
  cellMeter: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'left',
  },
  cellCount: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'left',
  },
  tempoSpacer: {
    height: 14,
  },
  accentScrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: 4,
  },
  editorBlock: {
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 4,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  meterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  numeratorInput: {
    width: 44,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  inputFocused: {
    borderColor: studioColors.accent,
  },
  slash: {
    fontSize: 26,
    fontWeight: '700',
    color: studioColors.textPrimary,
    lineHeight: 30,
    marginHorizontal: 2,
  },
  denominatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  denomChip: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  denomChipSelected: {
    backgroundColor: studioColors.accent,
    borderColor: studioColors.accent,
  },
  denomText: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
  },
  denomTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  barCountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 28,
    flexShrink: 0,
  },
  multiply: {
    fontSize: 18,
    fontWeight: '700',
    color: studioColors.textPrimary,
  },
  barCountInput: {
    width: 44,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  tempoBlock: {
    gap: 8,
    paddingTop: 2,
  },
  tempoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: studioColors.textSecondary,
    letterSpacing: 0.3,
  },
  tempoCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 36,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: studioColors.accent,
    borderColor: studioColors.accent,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  tempoCheckLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  segmentBpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 32,
  },
  segmentBpmRowDisabled: {
    opacity: 0.45,
  },
  bpmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textSecondary,
  },
  bpmLabelDisabled: {
    color: studioColors.textMuted,
  },
  segmentBpmInput: {
    width: 64,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  segmentBpmInputDisabled: {
    color: studioColors.textSecondary,
  },
});
