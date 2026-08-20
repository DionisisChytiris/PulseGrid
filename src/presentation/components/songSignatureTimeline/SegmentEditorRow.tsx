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
import Ionicons from '@expo/vector-icons/Ionicons';

import { SECTION_NAME_PRESETS } from '../../../domain/music/editor';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';
import { studioColors } from '../../theme';
import { AccentPatternToggleRow } from '../metronome/AccentPatternToggleRow';
import { SubdivisionOptionRow } from '../metronome/SubdivisionOptionRow';
import type { SubdivisionKind } from '../../../domain/valueObjects/Subdivision';
import { isBarSubdivisionEditable } from '../../../domain/music/barSubdivision';

import {
  METER_DENOMINATORS,
  normalizeDenominator,
  type MeterDenominator,
} from './meterPickerValidation';
import { InlineTempoMarking } from './InlineTempoMarking';
import type { SectionCreateMode } from './sectionCreateMode';

export type { SectionCreateMode } from './sectionCreateMode';
export type SegmentEditorActiveField =
  | { segmentId: string; kind: 'numerator' }
  | { segmentId: string; kind: 'barCount' }
  | { segmentId: string; kind: 'segmentBpm' }
  | { segmentId: string; kind: 'sectionName' }
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
  onDuplicate: () => void;
  onDelete?: () => void;
  canDelete: boolean;
  onNumeratorFocus: () => void;
  onBarCountFocus: () => void;
  onSegmentBpmFocus: () => void;
  onDenominatorChange: (denominator: MeterDenominator) => void;
  onUseSongTempoChange: (useSongTempo: boolean) => void;
  onAccentPatternChange: (pattern: boolean[]) => void;
  onSubdivisionChange: (subdivision: SubdivisionKind) => void;
  onRegisterNumeratorInput: (ref: TextInputType | null) => void;
  onRegisterBarCountInput: (ref: TextInputType | null) => void;
  onRegisterSegmentBpmInput: (ref: TextInputType | null) => void;
  onRegisterSectionNameInput: (ref: TextInputType | null) => void;
  onLayoutY: (y: number, height: number) => void;
  sectionCreateMode: SectionCreateMode;
  sectionNameText: string;
  onSectionCreateModeChange: (mode: SectionCreateMode) => void;
  onSectionPresetSelect: (name: string) => void;
  onSectionNameFocus: () => void;
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
  onDuplicate,
  onDelete,
  canDelete,
  onNumeratorFocus,
  onBarCountFocus,
  onSegmentBpmFocus,
  onDenominatorChange,
  onUseSongTempoChange,
  onAccentPatternChange,
  onSubdivisionChange,
  onRegisterNumeratorInput,
  onRegisterBarCountInput,
  onRegisterSegmentBpmInput,
  onRegisterSectionNameInput,
  onLayoutY,
  sectionCreateMode,
  sectionNameText,
  onSectionCreateModeChange,
  onSectionPresetSelect,
  onSectionNameFocus,
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
  const sectionNameFocused =
    activeField?.kind === 'sectionName' &&
    'segmentId' in activeField &&
    activeField.segmentId === segment.id;
  const denominator = parseDenominatorFromMeter(segment.meter);
  const accentPattern = accentFlagsFromSegment(segment);
  const rangeLabel = barsRangeLabel(segment.startBar, segment.endBar);
  const useSongTempo = segment.bpmOverride === null;
  const establishedSection =
    segment.isSectionStart &&
    segment.showSectionVisuals &&
    segment.sectionName.trim().length > 0;
  const showNoneChoice = sectionCreateMode === 'none' || establishedSection;
  const showPresetChoice =
    sectionCreateMode === 'none' ||
    sectionCreateMode === 'preset' ||
    (establishedSection && sectionCreateMode === 'custom');
  const showCustomChoice = sectionCreateMode === 'none' || sectionCreateMode === 'custom';
  const showPresetChips = sectionCreateMode === 'preset' && !establishedSection;
  const showCustomInput = sectionCreateMode === 'custom' && !establishedSection;
  const showSectionNameLabel =
    establishedSection && sectionCreateMode !== 'none';
  const showSectionRowSpacer = !showPresetChips && !showCustomInput;

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
            <InlineTempoMarking bpm={overviewTempoBpm} style={styles.overviewTempo} />
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

            <View style={styles.editorRowSpacer} />

            <View style={styles.segmentActionButtons}>
              <Pressable
                onPress={onDuplicate}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Duplicate segment"
                style={({ pressed }) => [
                  styles.segmentActionButton,
                  pressed && styles.segmentActionPressed,
                ]}
              >
                <Ionicons name="copy-outline" size={16} color={studioColors.accent} />
                <Text style={styles.duplicateActionText}>Duplicate</Text>
              </Pressable>

              {canDelete && onDelete !== undefined ? (
                <Pressable
                  onPress={onDelete}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Delete segment"
                  style={({ pressed }) => [
                    styles.segmentActionButton,
                    pressed && styles.segmentActionPressed,
                  ]}
                >
                  <Ionicons name="trash-outline" size={16} color={studioColors.danger} />
                  <Text style={styles.deleteActionText}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.tempoRow}>
            <Text style={styles.tempoTitle}>Tempo:</Text>
            <Pressable
              onPress={() => onUseSongTempoChange(!useSongTempo)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useSongTempo }}
              accessibilityLabel={
                useSongTempo
                  ? `Use timeline tempo ${songDefaultBpm} BPM`
                  : 'Use timeline tempo'
              }
              style={styles.tempoCheckRow}
            >
              <View style={[styles.checkbox, useSongTempo && styles.checkboxChecked]}>
                {useSongTempo ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
              <Text style={styles.tempoCheckLabel} numberOfLines={1}>
                {useSongTempo ? `Timeline (${songDefaultBpm})` : 'Timeline'}
              </Text>
            </Pressable>

            {useSongTempo ? null : (
              <View style={styles.segmentBpmRow}>
                <Text style={styles.bpmLabel}>BPM</Text>
                <TextInput
                  ref={onRegisterSegmentBpmInput}
                  style={[styles.segmentBpmInput, segmentBpmFocused && styles.inputFocused]}
                  value={segmentBpmText}
                  showSoftInputOnFocus={false}
                  caretHidden={!segmentBpmFocused}
                  disableFullscreenUI
                  selectTextOnFocus
                  maxLength={3}
                  accessibilityLabel="Segment BPM override"
                  onFocus={onSegmentBpmFocus}
                />
              </View>
            )}
          </View>

          {isBarSubdivisionEditable(denominator) ? (
            <SubdivisionOptionRow
              selected={segment.subdivision}
              onChange={onSubdivisionChange}
            />
          ) : null}

          <View style={styles.sectionCreateRow}>
            <Text style={styles.sectionCreateLabel}>Create Section:</Text>

            {showNoneChoice ? (
              <Pressable
                onPress={() => onSectionCreateModeChange('none')}
                accessibilityRole="radio"
                accessibilityState={{ selected: sectionCreateMode === 'none' }}
                accessibilityLabel="No section"
                style={styles.sectionChoice}
              >
                <View
                  style={[
                    styles.radioOuter,
                    sectionCreateMode === 'none' && styles.radioOuterSelected,
                  ]}
                >
                  {sectionCreateMode === 'none' ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.sectionChoiceText}>None</Text>
              </Pressable>
            ) : null}

            {showPresetChoice ? (
              <Pressable
                onPress={() => onSectionCreateModeChange('preset')}
                accessibilityRole="radio"
                accessibilityState={{ selected: sectionCreateMode === 'preset' }}
                accessibilityLabel="Preset section"
                style={styles.sectionChoice}
              >
                <View
                  style={[
                    styles.radioOuter,
                    sectionCreateMode === 'preset' && styles.radioOuterSelected,
                  ]}
                >
                  {sectionCreateMode === 'preset' ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.sectionChoiceText}>Preset</Text>
              </Pressable>
            ) : null}

            {showCustomChoice ? (
              <Pressable
                onPress={() => onSectionCreateModeChange('custom')}
                accessibilityRole="radio"
                accessibilityState={{ selected: sectionCreateMode === 'custom' }}
                accessibilityLabel="Custom section"
                style={styles.sectionChoice}
              >
                <View
                  style={[
                    styles.radioOuter,
                    sectionCreateMode === 'custom' && styles.radioOuterSelected,
                  ]}
                >
                  {sectionCreateMode === 'custom' ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.sectionChoiceText}>Custom</Text>
              </Pressable>
            ) : null}

            {showPresetChips ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={styles.presetScroll}
                contentContainerStyle={styles.presetScrollContent}
              >
                {SECTION_NAME_PRESETS.map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => onSectionPresetSelect(name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Create ${name} section`}
                    style={({ pressed }) => [
                      styles.presetChip,
                      pressed && styles.segmentActionPressed,
                    ]}
                  >
                    <Text style={styles.presetChipText}>{name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {showCustomInput ? (
              <TextInput
                ref={onRegisterSectionNameInput}
                style={[styles.sectionNameInput, sectionNameFocused && styles.inputFocused]}
                value={sectionNameText}
                showSoftInputOnFocus={false}
                caretHidden={!sectionNameFocused}
                disableFullscreenUI
                selectTextOnFocus
                maxLength={18}
                placeholder="Section name"
                placeholderTextColor={studioColors.textMuted}
                accessibilityLabel="Custom section name"
                onFocus={onSectionNameFocus}
              />
            ) : null}

            {showSectionRowSpacer ? <View style={styles.sectionCreateSpacer} /> : null}

            {showSectionNameLabel ? (
              <Text
                style={styles.currentSectionName}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={`Section ${segment.sectionName}`}
              >
                {segment.sectionName}
              </Text>
            ) : null}
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
  overviewTempo: {
    fontSize: 14,
  },
  accentScrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: 4,
  },
  editorBlock: {
    gap: 8,
    paddingBottom: 8,
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
    marginLeft: 12,
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
  editorRowSpacer: {
    flex: 1,
    minWidth: 8,
  },
  tempoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  tempoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: studioColors.textSecondary,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  tempoCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    flexShrink: 0,
    paddingRight: 4,
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
    flexShrink: 0,
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
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  segmentActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  segmentActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 40,
  },
  segmentActionPressed: {
    opacity: 0.65,
  },
  duplicateActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.accent,
  },
  deleteActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.danger,
  },
  segmentBpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  bpmLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textSecondary,
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
  sectionCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
  },
  sectionCreateLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: studioColors.textSecondary,
    flexShrink: 0,
  },
  sectionChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    flexShrink: 0,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: studioColors.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: studioColors.accent,
  },
  sectionChoiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  presetScroll: {
    flex: 1,
    minWidth: 0,
  },
  presetScrollContent: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  presetChip: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: studioColors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.textPrimary,
  },
  sectionNameInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: studioColors.border,
    backgroundColor: studioColors.background,
    color: studioColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  sectionCreateSpacer: {
    flex: 1,
    minWidth: 8,
  },
  currentSectionName: {
    flexShrink: 1,
    maxWidth: 140,
    fontSize: 13,
    fontWeight: '600',
    color: studioColors.textSecondary,
    textAlign: 'right',
  },
});
