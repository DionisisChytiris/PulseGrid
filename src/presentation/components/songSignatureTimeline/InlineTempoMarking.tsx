import { memo } from 'react';
import {
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { studioColors } from '../../theme';

type FormatOptions = {
  /** Leading space for nesting after a meter label (Song Line). Default true. */
  readonly leadingSpace?: boolean;
};

/** Shared musical tempo text used on Song Line and Edit Segment overview. */
export function formatInlineTempoMarking(
  bpm: number,
  options: FormatOptions = {},
): string {
  const body = `♩ = ${bpm}`;
  return options.leadingSpace === false ? body : ` ${body}`;
}

type Props = {
  bpm: number;
  /** Leading space when nested after a meter label. Default true. */
  leadingSpace?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<TextStyle>;
};

/**
 * Plain-text tempo marking (♩ = N) in the Song Line orange accent style.
 */
export const InlineTempoMarking = memo(function InlineTempoMarking({
  bpm,
  leadingSpace = true,
  onPress,
  style,
}: Props) {
  return (
    <Text
      style={[styles.marking, style]}
      onPress={onPress}
      suppressHighlighting={onPress !== undefined}
    >
      {formatInlineTempoMarking(bpm, { leadingSpace })}
    </Text>
  );
});

const styles = StyleSheet.create({
  marking: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: studioColors.beatAccent,
    letterSpacing: 0,
  },
});
