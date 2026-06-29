export const MS_PER_MINUTE = 60_000;

export interface TempoState {
  readonly bpm: number;
}

export function createTempoState(bpm: number): TempoState {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive number');
  }

  return { bpm };
}

/**
 * Describes how tempo may change over a timeline.
 * A single-entry map represents constant tempo (quick metronome).
 * Multi-entry maps are reserved for tempo automation (future).
 */
export type TempoMapEntry = {
  startBeat: number;
  bpm: number;
};

export class TempoMap {
  private readonly entries: TempoMapEntry[];

  constructor(entries: TempoMapEntry[]) {
    if (entries.length === 0) {
      throw new Error('TempoMap must contain at least one entry');
    }

    const sorted = [...entries].sort((a, b) => a.startBeat - b.startBeat);

    if (sorted[0].startBeat !== 0) {
      throw new Error('TempoMap must define tempo at beat 0');
    }

    for (const entry of sorted) {
      if (!Number.isFinite(entry.bpm) || entry.bpm <= 0) {
        throw new RangeError('Each tempo entry must have a positive BPM');
      }
    }

    this.entries = sorted;
  }

  static constant(bpm: number): TempoMap {
    return new TempoMap([{ startBeat: 0, bpm }]);
  }

  getBpmAtBeat(beat: number): number {
    if (beat < 0) {
      throw new RangeError('Beat index cannot be negative');
    }

    let bpm = this.entries[0].bpm;

    for (const entry of this.entries) {
      if (entry.startBeat > beat) {
        break;
      }
      bpm = entry.bpm;
    }

    return bpm;
  }

  toTempoState(): TempoState {
    return createTempoState(this.entries[0].bpm);
  }
}
