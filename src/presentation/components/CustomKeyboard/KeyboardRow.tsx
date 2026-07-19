import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { KeyboardKey, type KeyboardKeyVariant } from './KeyboardKey';
import type { KeyboardKeyDef, KeyboardRowDef, ShiftState } from './keyboardLayouts';

type Props = {
  row: KeyboardRowDef;
  shift: ShiftState;
  variant: KeyboardKeyVariant;
  onKeyPress: (key: KeyboardKeyDef) => void;
};

/** Horizontal row of keyboard keys with consistent spacing. */
export const KeyboardRow = memo(function KeyboardRow({
  row,
  shift,
  variant,
  onKeyPress,
}: Props) {
  return (
    <View style={[styles.row, variant === 'right' && styles.rowRight]}>
      {row.map((keyDef, index) => (
        <KeyboardKey
          key={`${keyDef.id}-${keyDef.label}-${index}`}
          keyDef={keyDef}
          shift={shift}
          variant={variant}
          onPress={onKeyPress}
          style={index > 0 ? styles.keyGap : undefined}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
  },
  rowRight: {
    flex: 1,
  },
  keyGap: {
    marginLeft: 3,
  },
});
