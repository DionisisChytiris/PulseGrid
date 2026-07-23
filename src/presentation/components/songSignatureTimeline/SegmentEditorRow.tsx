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

export type SegmentEditorActiveField =
  | { segmentId: string; kind: 'numerator' }
  | { segmentId: string; kind: 'barCount' };

type Props = {
  segment: TimelineSegmentViewModel;
  expanded: boolean;
  numeratorText: string;
  barCountText: string;
  activeField: SegmentEditorActiveField | null;
  onToggleExpand: () => void;
  onNumeratorFocus: () => void;
  onBarCountFocus: () => void;
  onDenominatorChange: (denominator: MeterDenominator) => void;
  onAccentPatternChange: (pattern: boolean[]) => void;
  onRegisterNumeratorInput: (ref: TextInputType | null) => void;
  onRegisterBarCountInput: (ref: TextInputType | null) => void;
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
 * Percentage-column overview (15% | 15% | 15% | 55%).
 * Expanded: highlighted row + meter / bar-count editors underneath.
 */
export const SegmentEditorRow = memo(function SegmentEditorRow({
  segment,
  expanded,
  numeratorText,
  barCountText,
  activeField,
  onToggleExpand,
  onNumeratorFocus,
  onBarCountFocus,
  onDenominatorChange,
  onAccentPatternChange,
  onRegisterNumeratorInput,
  onRegisterBarCountInput,
  onLayoutY,
}: Props) {
  const numeratorFocused =
    activeField?.segmentId === segment.id && activeField.kind === 'numerator';
  const barCountFocused =
    activeField?.segmentId === segment.id && activeField.kind === 'barCount';
  const denominator = parseDenominatorFromMeter(segment.meter);
  const accentPattern = accentFlagsFromSegment(segment);
  const rangeLabel = barsRangeLabel(segment.startBar, segment.endBar);

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
          <Text style={styles.cellCentered} numberOfLines={1}>
            {segment.meter}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleExpand}
          accessibilityRole="button"
          accessibilityLabel={`Bar count ${segment.numberOfBars}`}
          style={({ pressed }) => [styles.colCount, pressed && styles.colPressed]}
        >
          <Text style={styles.cellCentered} numberOfLines={1}>
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
    width: '15%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  colMeter: {
    width: '15%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colCount: {
    width: '15%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colAccents: {
    width: '55%',
    paddingVertical: 4,
    paddingHorizontal: 6,
    justifyContent: 'center',
    minHeight: 44,
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
  cellCentered: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: studioColors.textPrimary,
    textAlign: 'center',
    width: '100%',
  },
  accentScrollContent: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: 4,
  },
  editorBlock: {
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
});
