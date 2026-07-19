import { useCallback, useRef, useState } from 'react';

import type { ShiftState } from './keyboardLayouts';

const DOUBLE_TAP_MS = 350;

/**
 * Shift / Caps Lock state for the letter keyboard.
 * - off: lowercase
 * - once: next letter uppercase, then off
 * - caps: sticky uppercase until shift tapped again
 */
export function useShiftState() {
  const [shift, setShift] = useState<ShiftState>('off');
  const lastShiftTapAt = useRef(0);

  const toggleShift = useCallback(() => {
    const now = Date.now();
    const isDoubleTap = now - lastShiftTapAt.current <= DOUBLE_TAP_MS;
    lastShiftTapAt.current = now;

    setShift((current) => {
      // Any tap while Caps Lock is on turns it off.
      if (current === 'caps') {
        return 'off';
      }

      // Second tap within the window enables Caps Lock.
      if (isDoubleTap) {
        return 'caps';
      }

      // Toggle one-shot shift.
      if (current === 'once') {
        return 'off';
      }

      return 'once';
    });
  }, []);

  /** After inserting a letter while in "once", drop back to lowercase. */
  const consumeOneShotShift = useCallback(() => {
    setShift((current) => (current === 'once' ? 'off' : current));
  }, []);

  const resetShift = useCallback(() => {
    setShift('off');
    lastShiftTapAt.current = 0;
  }, []);

  return {
    shift,
    toggleShift,
    consumeOneShotShift,
    resetShift,
  };
}
