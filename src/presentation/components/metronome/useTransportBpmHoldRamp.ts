import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

const HOLD_DELAY_MS = 1000;
/** Minimum emit interval while ramping (limits native setTempo spam). */
const MIN_EMIT_INTERVAL_MS = 80;
/** BPM/s at ramp start — high enough for a visible step soon after the 1s hold. */
const MIN_RATE_BPM_PER_SEC = 10;
const MAX_RATE_BPM_PER_SEC = 60;
/** Reach max rate ~1s after ramp starts (~2s total hold). */
const ACCEL_DURATION_SEC = 1;

export type BpmRampDirection = 1 | -1;

type UseTransportBpmHoldRampArgs = {
  bpm: number;
  minimumValue: number;
  maximumValue: number;
  onValueChange: (bpm: number) => void;
  /** True while the tempo ring is being dragged — blocks arming/starting a ramp. */
  isDialDraggingRef: MutableRefObject<boolean>;
};

function clampBpm(value: number, minimumValue: number, maximumValue: number): number {
  return Math.min(maximumValue, Math.max(minimumValue, Math.round(value)));
}

function rateBpmPerSec(elapsedSec: number): number {
  const u = Math.min(1, Math.max(0, elapsedSec / ACCEL_DURATION_SEC));
  const eased = u * u;
  return MIN_RATE_BPM_PER_SEC + (MAX_RATE_BPM_PER_SEC - MIN_RATE_BPM_PER_SEC) * eased;
}

/**
 * Touch-only long-press BPM ramp for the transport control.
 * Direction must be fixed at press-in; does not read playing state after the delay.
 */
export function useTransportBpmHoldRamp({
  bpm,
  minimumValue,
  maximumValue,
  onValueChange,
  isDialDraggingRef,
}: UseTransportBpmHoldRampArgs) {
  const generationRef = useRef(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const bpmRef = useRef(bpm);
  const minRef = useRef(minimumValue);
  const maxRef = useRef(maximumValue);
  const onValueChangeRef = useRef(onValueChange);

  bpmRef.current = bpm;
  minRef.current = minimumValue;
  maxRef.current = maximumValue;
  onValueChangeRef.current = onValueChange;

  const clearHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
  }, []);

  const clearRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const endHoldRamp = useCallback(() => {
    generationRef.current += 1;
    clearHoldTimeout();
    clearRaf();
  }, [clearHoldTimeout, clearRaf]);

  const startRampLoop = useCallback(
    (generation: number, direction: BpmRampDirection) => {
      clearRaf();

      let continuousBpm = bpmRef.current;
      let lastEmitted = Math.round(continuousBpm);
      let lastEmitAt = 0;
      let lastFrameAt = performance.now();
      const rampStartedAt = lastFrameAt;

      const tick = (now: number) => {
        if (generation !== generationRef.current) {
          return;
        }

        if (isDialDraggingRef.current) {
          endHoldRamp();
          return;
        }

        const dtSec = Math.min(0.05, Math.max(0, (now - lastFrameAt) / 1000));
        lastFrameAt = now;

        const elapsedSec = (now - rampStartedAt) / 1000;
        continuousBpm += rateBpmPerSec(elapsedSec) * dtSec * direction;

        const next = clampBpm(continuousBpm, minRef.current, maxRef.current);
        continuousBpm = next;

        if (next !== lastEmitted && now - lastEmitAt >= MIN_EMIT_INTERVAL_MS) {
          lastEmitted = next;
          lastEmitAt = now;
          onValueChangeRef.current(next);
        }

        // Stop looping at hard limits.
        if (
          (direction > 0 && next >= maxRef.current) ||
          (direction < 0 && next <= minRef.current)
        ) {
          rafRef.current = null;
          return;
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    },
    [clearRaf, endHoldRamp, isDialDraggingRef],
  );

  const beginHoldRamp = useCallback(
    (direction: BpmRampDirection) => {
      endHoldRamp();
      const generation = generationRef.current;

      holdTimeoutRef.current = setTimeout(() => {
        holdTimeoutRef.current = null;
        if (generation !== generationRef.current) {
          return;
        }
        if (isDialDraggingRef.current) {
          return;
        }
        startRampLoop(generation, direction);
      }, HOLD_DELAY_MS);
    },
    [endHoldRamp, isDialDraggingRef, startRampLoop],
  );

  useEffect(() => () => endHoldRamp(), [endHoldRamp]);

  return { beginHoldRamp, endHoldRamp };
}
