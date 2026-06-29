function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
}

/**
 * Accent flags for each beat in a measure (index 0 = beat 1).
 *
 * Examples:
 * - 4/4: [true, false, false, false]
 * - 3/4: [true, false, false]
 * - 7/8: [true, false, true, false, true, false, false]
 */
export class AccentPattern {
  private readonly accents: readonly boolean[];
  private readonly beatsPerMeasure: number;

  private constructor(accents: readonly boolean[], beatsPerMeasure: number) {
    this.accents = accents;
    this.beatsPerMeasure = beatsPerMeasure;
  }

  static create(accents: readonly boolean[], beatsPerMeasure: number): AccentPattern {
    assertPositiveInteger(beatsPerMeasure, 'Beats per measure');

    if (accents.length === 0) {
      throw new RangeError('Accent pattern must have at least one beat');
    }

    if (accents.length !== beatsPerMeasure) {
      throw new RangeError(
        `Accent pattern length (${accents.length}) must equal beats per measure (${beatsPerMeasure})`,
      );
    }

    return new AccentPattern([...accents], beatsPerMeasure);
  }

  /** Default pattern: accent on beat 1 only. */
  static downbeatOnly(beatsPerMeasure: number): AccentPattern {
    assertPositiveInteger(beatsPerMeasure, 'Beats per measure');

    return AccentPattern.create(
      [true, ...Array.from({ length: beatsPerMeasure - 1 }, () => false)],
      beatsPerMeasure,
    );
  }

  getBeatsPerMeasure(): number {
    return this.beatsPerMeasure;
  }

  toArray(): readonly boolean[] {
    return [...this.accents];
  }

  /**
   * Returns whether the given continuous beat index is accented.
   * Maps the global index into the measure cycle.
   */
  isAccent(beatIndex: number): boolean {
    assertNonNegativeInteger(beatIndex, 'Beat index');
    return this.accents[beatIndex % this.beatsPerMeasure] ?? false;
  }
}
