import { useCallback, useEffect, useRef } from 'react';

const HOLD_DELAY_MS = 380;
const HOLD_INTERVAL_MS = 70;

type Args = {
  onStep: (direction: 1 | -1) => void;
};

/**
 * Tap steps once; press-and-hold repeats after a short delay.
 */
export function useBpmStepHold({ onStep }: Args) {
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const directionRef = useRef<1 | -1>(1);

  const clearTimers = useCallback(() => {
    if (delayRef.current !== null) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const endHold = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const beginHold = useCallback(
    (direction: 1 | -1) => {
      clearTimers();
      directionRef.current = direction;
      onStepRef.current(direction);

      delayRef.current = setTimeout(() => {
        delayRef.current = null;
        intervalRef.current = setInterval(() => {
          onStepRef.current(directionRef.current);
        }, HOLD_INTERVAL_MS);
      }, HOLD_DELAY_MS);
    },
    [clearTimers],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { beginHold, endHold };
}
