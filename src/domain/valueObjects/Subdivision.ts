export type SubdivisionKind = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

/** Subdivisions supported by the native timing engine. */
export type NativeSubdivisionKind = SubdivisionKind;

export const NATIVE_SUBDIVISION_ORDER: readonly NativeSubdivisionKind[] = [
  'quarter',
  'eighth',
  'triplet',
  'sixteenth',
];

export function toNativeSubdivision(kind: SubdivisionKind): NativeSubdivisionKind {
  return kind;
}

const TICKS_PER_BEAT: Record<SubdivisionKind, number> = {
  quarter: 1,
  eighth: 2,
  triplet: 3,
  sixteenth: 4,
};

function assertSubdivisionIndex(subdivisionIndex: number, ticksPerBeat: number): void {
  if (!Number.isInteger(subdivisionIndex) || subdivisionIndex < 0) {
    throw new RangeError('Subdivision index must be a non-negative integer');
  }

  if (subdivisionIndex >= ticksPerBeat) {
    throw new RangeError(
      `Subdivision index (${subdivisionIndex}) must be less than ticks per beat (${ticksPerBeat})`,
    );
  }
}

/**
 * Describes how each beat is divided into pulses.
 */
export class Subdivision {
  private readonly kind: SubdivisionKind;
  private readonly ticksPerBeat: number;

  private constructor(kind: SubdivisionKind) {
    this.kind = kind;
    this.ticksPerBeat = TICKS_PER_BEAT[kind];
  }

  static quarter(): Subdivision {
    return new Subdivision('quarter');
  }

  static eighth(): Subdivision {
    return new Subdivision('eighth');
  }

  static triplet(): Subdivision {
    return new Subdivision('triplet');
  }

  static sixteenth(): Subdivision {
    return new Subdivision('sixteenth');
  }

  static fromKind(kind: SubdivisionKind): Subdivision {
    if (!(kind in TICKS_PER_BEAT)) {
      throw new RangeError(`Unsupported subdivision kind: ${kind}`);
    }

    return new Subdivision(kind);
  }

  getKind(): SubdivisionKind {
    return this.kind;
  }

  getTicksPerBeat(): number {
    return this.ticksPerBeat;
  }

  /** Portion of one beat occupied by a single subdivision tick. */
  getBeatFraction(): number {
    return 1 / this.ticksPerBeat;
  }

  isPrimaryBeat(subdivisionIndex: number): boolean {
    assertSubdivisionIndex(subdivisionIndex, this.ticksPerBeat);
    return subdivisionIndex === 0;
  }

  splitBeatIndex(globalTickIndex: number): {
    beatIndex: number;
    subdivisionIndex: number;
  } {
    if (!Number.isInteger(globalTickIndex) || globalTickIndex < 0) {
      throw new RangeError('Global tick index must be a non-negative integer');
    }

    return {
      beatIndex: Math.floor(globalTickIndex / this.ticksPerBeat),
      subdivisionIndex: globalTickIndex % this.ticksPerBeat,
    };
  }
}
