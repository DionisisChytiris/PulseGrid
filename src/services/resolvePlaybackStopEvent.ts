/** Skip accidental start/stop noise. */
export const MIN_PLAYBACK_DURATION_SECONDS = 2;

export function resolvePlaybackStopEvent(
  startedAtMs: number | null,
  nowMs: number,
): { duration_seconds: number } | null {
  if (startedAtMs === null) {
    return null;
  }

  const duration_seconds = Math.max(0, Math.round((nowMs - startedAtMs) / 1000));
  if (duration_seconds < MIN_PLAYBACK_DURATION_SECONDS) {
    return null;
  }

  return { duration_seconds };
}
