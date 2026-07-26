import { memo } from 'react';
import {
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { getTempoMarkingColor } from './tempoMarkingColor';

type FormatOptions = {
  /** Leading space for nesting after a meter label. Default false. */
  readonly leadingSpace?: boolean;
};

/** Shared musical tempo text used on Song Line and Edit Segment overview. */
export function formatInlineTempoMarking(
  bpm: number,
  options: FormatOptions = {},
): string {
  const body = `♩ = ${bpm}`;
  return options.leadingSpace === true ? ` ${body}` : body;
}

type Props = {
  bpm: number;
  /** Leading space when nested after a meter label. Default false. */
  leadingSpace?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<TextStyle>;
};

/**
 * Plain-text tempo marking (♩ = N). Colour tracks BPM band; no chrome.
 */
export const InlineTempoMarking = memo(function InlineTempoMarking({
  bpm,
  leadingSpace = false,
  onPress,
  style,
}: Props) {
  return (
    <Text
      style={[styles.marking, { color: getTempoMarkingColor(bpm) }, style]}
      onPress={onPress}
      suppressHighlighting={onPress !== undefined}
      numberOfLines={1}
    >
      {formatInlineTempoMarking(bpm, { leadingSpace })}
    </Text>
  );
});

const styles = StyleSheet.create({
  marking: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
});
