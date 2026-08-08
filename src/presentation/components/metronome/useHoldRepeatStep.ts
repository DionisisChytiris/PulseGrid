import { useCallback, useEffect, useRef } from 'react';

/** Pause after the first step before auto-repeat begins. */
export const HOLD_REPEAT_DELAY_MS = 400;
/** Interval between repeated steps while held. */
export const HOLD_REPEAT_INTERVAL_MS = 90;

function clampInt(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

type UseHoldRepeatStepArgs = {
  value: number;
  minimumValue: number;
  maximumValue: number;
  onChange: (value: number) => void;
};

/**
 * Tap-once + press-and-hold repeat for numeric steppers
 * (Quick Metronome BPM +/- and Practice Trainer BPM increase).
 */
export function useHoldRepeatStep({
  value,
  minimumValue,
  maximumValue,
  onChange,
}: UseHoldRepeatStepArgs) {
  const valueRef = useRef(value);
  const minRef = useRef(minimumValue);
  const maxRef = useRef(maximumValue);
  const onChangeRef = useRef(onChange);
  const holdDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  valueRef.current = value;
  minRef.current = minimumValue;
  maxRef.current = maximumValue;
  onChangeRef.current = onChange;

  const stopHoldRepeat = useCallback(() => {
    if (holdDelayRef.current !== null) {
      clearTimeout(holdDelayRef.current);
      holdDelayRef.current = null;
    }
    if (holdIntervalRef.current !== null) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const step = useCallback((delta: number) => {
    const next = clampInt(valueRef.current + delta, minRef.current, maxRef.current);
    if (next === valueRef.current) {
      return false;
    }
    // Keep local ref in sync between prop updates so hold-repeat never stalls on stale value.
    valueRef.current = next;
    onChangeRef.current(next);
    return true;
  }, []);

  const beginHoldRepeat = useCallback(
    (delta: number) => {
      stopHoldRepeat();
      step(delta);

      holdDelayRef.current = setTimeout(() => {
        holdDelayRef.current = null;
        holdIntervalRef.current = setInterval(() => {
          const stepped = step(delta);
          if (!stepped) {
            stopHoldRepeat();
          }
        }, HOLD_REPEAT_INTERVAL_MS);
      }, HOLD_REPEAT_DELAY_MS);
    },
    [step, stopHoldRepeat],
  );

  useEffect(() => () => stopHoldRepeat(), [stopHoldRepeat]);

  return { beginHoldRepeat, stopHoldRepeat };
}
