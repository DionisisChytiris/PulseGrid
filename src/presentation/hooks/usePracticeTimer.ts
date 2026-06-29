import { useCallback, useEffect, useRef, useState } from 'react';

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function usePracticeTimer(isPlaying: boolean) {
  const [isArmed, setIsArmed] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    if (!isArmed || !isPlaying) {
      return;
    }

    const startedAt = Date.now();
    const base = accumulatedRef.current;

    const intervalId = setInterval(() => {
      setElapsedMs(base + Date.now() - startedAt);
    }, 200);

    return () => {
      clearInterval(intervalId);
      const sessionElapsed = Date.now() - startedAt;
      accumulatedRef.current = base + sessionElapsed;
      setElapsedMs(accumulatedRef.current);
    };
  }, [isArmed, isPlaying]);

  const toggle = useCallback(() => {
    if (!isArmed) {
      accumulatedRef.current = 0;
      setElapsedMs(0);
      setIsArmed(true);
      return;
    }

    if (isPlaying) {
      return;
    }

    accumulatedRef.current = 0;
    setElapsedMs(0);
    setIsArmed(false);
  }, [isArmed, isPlaying]);

  const reset = useCallback(() => {
    if (!isArmed || isPlaying) {
      return;
    }

    accumulatedRef.current = 0;
    setElapsedMs(0);
  }, [isArmed, isPlaying]);

  return {
    isArmed,
    elapsedMs,
    displayTime: formatElapsed(elapsedMs),
    toggle,
    reset,
  };
}
