export type KeyboardMode = 'letters' | 'numbers';

export type KeyboardPlacement = 'bottom' | 'right' | 'auto';

export type KeyboardKeyId =
  | 'char'
  | 'space'
  | 'backspace'
  | 'mode'
  | 'done'
  | 'shift';

export type KeyboardKeyDef = {
  readonly id: KeyboardKeyId;
  /** Base display label (letters use lowercase; casing applied at render time). */
  readonly label: string;
  /** Character to insert when id is 'char' (lowercase for letters). */
  readonly char?: string;
  /** Relative width weight within a row (default 1). */
  readonly flex?: number;
};

export type KeyboardRowDef = readonly KeyboardKeyDef[];

export type ShiftState = 'off' | 'once' | 'caps';

const letter = (ch: string): KeyboardKeyDef => ({
  id: 'char',
  label: ch,
  char: ch,
});

const LETTER_TOP: KeyboardRowDef = [
  letter('q'),
  letter('w'),
  letter('e'),
  letter('r'),
  letter('t'),
  letter('y'),
  letter('u'),
  letter('i'),
  letter('o'),
  letter('p'),
];

const LETTER_MIDDLE: KeyboardRowDef = [
  letter('a'),
  letter('s'),
  letter('d'),
  letter('f'),
  letter('g'),
  letter('h'),
  letter('j'),
  letter('k'),
  letter('l'),
];

const LETTER_BOTTOM: KeyboardRowDef = [
  { id: 'shift', label: '⇧', flex: 1.35 },
  letter('z'),
  letter('x'),
  letter('c'),
  letter('v'),
  letter('b'),
  letter('n'),
  letter('m'),
  { id: 'backspace', label: '⌫', flex: 1.35 },
];

const LETTER_ACTION: KeyboardRowDef = [
  { id: 'mode', label: '123', flex: 1.5 },
  { id: 'space', label: 'Space', flex: 4 },
  { id: 'done', label: 'Done', flex: 1.7 },
];

const NUMBER_TOP: KeyboardRowDef = [
  { id: 'char', label: '1', char: '1' },
  { id: 'char', label: '2', char: '2' },
  { id: 'char', label: '3', char: '3' },
];

const NUMBER_MIDDLE: KeyboardRowDef = [
  { id: 'char', label: '4', char: '4' },
  { id: 'char', label: '5', char: '5' },
  { id: 'char', label: '6', char: '6' },
];

const NUMBER_BOTTOM: KeyboardRowDef = [
  { id: 'char', label: '7', char: '7' },
  { id: 'char', label: '8', char: '8' },
  { id: 'char', label: '9', char: '9' },
];

const NUMBER_SYMBOLS: KeyboardRowDef = [
  { id: 'char', label: '0', char: '0' },
  { id: 'char', label: '/', char: '/' },
  { id: 'char', label: '-', char: '-' },
];

const NUMBER_ACTION: KeyboardRowDef = [
  { id: 'mode', label: 'ABC', flex: 1.6 },
  { id: 'backspace', label: '⌫', flex: 1.6 },
  { id: 'done', label: 'Done', flex: 2 },
];

export const LETTER_LAYOUT: readonly KeyboardRowDef[] = [
  LETTER_TOP,
  LETTER_MIDDLE,
  LETTER_BOTTOM,
  LETTER_ACTION,
];

export const NUMBER_LAYOUT: readonly KeyboardRowDef[] = [
  NUMBER_TOP,
  NUMBER_MIDDLE,
  NUMBER_BOTTOM,
  NUMBER_SYMBOLS,
  NUMBER_ACTION,
];

export function layoutForMode(mode: KeyboardMode): readonly KeyboardRowDef[] {
  return mode === 'letters' ? LETTER_LAYOUT : NUMBER_LAYOUT;
}

/** Whether letter keys should render / insert as uppercase. */
export function isUppercaseActive(shift: ShiftState): boolean {
  return shift === 'once' || shift === 'caps';
}

/** Resolve display label for a key given shift state. */
export function resolveKeyLabel(key: KeyboardKeyDef, shift: ShiftState): string {
  if (key.id === 'shift') {
    if (shift === 'caps') {
      return '⇪';
    }
    return '⇧';
  }

  if (key.id === 'char' && key.char !== undefined && /[a-z]/.test(key.char)) {
    return isUppercaseActive(shift) ? key.char.toUpperCase() : key.char;
  }

  return key.label;
}

/** Character inserted for a char key given shift state. */
export function resolveInsertChar(key: KeyboardKeyDef, shift: ShiftState): string | null {
  if (key.id !== 'char' || key.char === undefined) {
    return null;
  }

  if (/[a-z]/.test(key.char) && isUppercaseActive(shift)) {
    return key.char.toUpperCase();
  }

  return key.char;
}

export function resolvePlacement(
  placement: KeyboardPlacement,
  width: number,
  height: number,
): 'bottom' | 'right' {
  if (placement === 'auto') {
    return width > height ? 'right' : 'bottom';
  }
  return placement;
}
