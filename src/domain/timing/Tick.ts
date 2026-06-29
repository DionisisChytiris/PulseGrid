/**
 * A single scheduled pulse in logical time.
 * `timestamp` is milliseconds from a schedule origin — not wall-clock time.
 */
export interface Tick {
  beatIndex: number;
  subdivisionIndex: number;
  isAccent: boolean;
  timestamp: number;
}
