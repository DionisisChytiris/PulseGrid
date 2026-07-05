/**
 * Pure timing signal from the metronome clock.
 * Accent flag is set by the timing source (native onTick or web scheduler).
 */
export interface TimingTick {
  /** Monotonic index since the current metronome run started. */
  sequence: number;
  /** One-based beat number within the current bar. */
  beatNumber: number;
  /** Zero-based subdivision pulse within the current beat. */
  subdivisionIndex: number;
  /** Whether this beat is accented per the active pattern. */
  isAccent: boolean;
  /** Milliseconds since the metronome run started. */
  timestamp: number;
}
