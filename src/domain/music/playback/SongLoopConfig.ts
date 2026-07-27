/**
 * Song Timeline loop configuration.
 * Phase 1: entire-song loop via [enabled].
 * Later: set [startBar]/[endBar] (inclusive, 0-based) for bar-range loops.
 */
export type SongLoopConfig = {
  readonly enabled: boolean;
  /** Inclusive 0-based start bar. Undefined = song start (bar 0). */
  readonly startBar?: number;
  /** Inclusive 0-based end bar. Undefined = song end. */
  readonly endBar?: number;
};

export const SONG_LOOP_DISABLED: SongLoopConfig = {
  enabled: false,
};

export function createEntireSongLoop(enabled: boolean): SongLoopConfig {
  return { enabled };
}

/** Resolve the bar to restart from when a loop cycle completes. */
export function resolveLoopRestartBar(config: SongLoopConfig): number {
  if (!config.enabled) {
    return 0;
  }

  return Math.max(0, Math.floor(config.startBar ?? 0));
}
