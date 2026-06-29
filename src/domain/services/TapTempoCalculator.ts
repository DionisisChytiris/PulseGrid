export type TapTempoConfig = {
  minBpm: number;
  maxBpm: number;
  minTaps: number;
  maxPauseMs: number;
  maxStoredTaps: number;
  /** How many most-recent intervals to average (faster convergence to steady tempo). */
  recentIntervalCount: number;
};

export const DEFAULT_TAP_TEMPO_CONFIG: TapTempoConfig = {
  minBpm: 30,
  maxBpm: 600,
  minTaps: 3,
  maxPauseMs: 2000,
  maxStoredTaps: 8,
  recentIntervalCount: 3,
};

export type TapTempoResult = {
  bpm: number | null;
  tapCount: number;
};

function clampBpm(value: number, minBpm: number, maxBpm: number): number {
  return Math.min(maxBpm, Math.max(minBpm, Math.round(value)));
}

/**
 * Calculates tempo from a sequence of tap timestamps.
 */
export class TapTempoCalculator {
  private readonly config: TapTempoConfig;
  private tapTimestamps: number[] = [];

  constructor(config: TapTempoConfig = DEFAULT_TAP_TEMPO_CONFIG) {
    this.config = config;
  }

  getTapCount(): number {
    return this.tapTimestamps.length;
  }

  reset(): void {
    this.tapTimestamps = [];
  }

  tap(timestampMs: number): TapTempoResult {
    if (!Number.isFinite(timestampMs) || timestampMs < 0) {
      throw new RangeError('Tap timestamp must be a non-negative finite number');
    }

    const lastTap = this.tapTimestamps[this.tapTimestamps.length - 1];

    if (lastTap !== undefined && timestampMs - lastTap > this.config.maxPauseMs) {
      this.tapTimestamps = [];
    }

    this.tapTimestamps.push(timestampMs);

    if (this.tapTimestamps.length > this.config.maxStoredTaps) {
      this.tapTimestamps = this.tapTimestamps.slice(-this.config.maxStoredTaps);
    }

    const tapCount = this.tapTimestamps.length;

    if (tapCount < this.config.minTaps) {
      return { bpm: null, tapCount };
    }

    const intervals: number[] = [];

    for (let index = 1; index < this.tapTimestamps.length; index += 1) {
      const interval = this.tapTimestamps[index] - this.tapTimestamps[index - 1];

      if (interval > 0 && interval <= this.config.maxPauseMs) {
        intervals.push(interval);
      }
    }

    if (intervals.length === 0) {
      return { bpm: null, tapCount };
    }

    const recentIntervals = intervals.slice(-this.config.recentIntervalCount);
    const averageIntervalMs =
      recentIntervals.reduce((total, interval) => total + interval, 0) /
      recentIntervals.length;
    const bpm = clampBpm(60_000 / averageIntervalMs, this.config.minBpm, this.config.maxBpm);

    return { bpm, tapCount };
  }
}
