/** Time signature for a single bar (e.g. 7/8, 4/4, 13/16). */
export interface Meter {
  readonly numerator: number;
  readonly denominator: number;
}

export function createMeter(numerator: number, denominator: number): Meter {
  if (!Number.isInteger(numerator) || numerator <= 0) {
    throw new RangeError('Meter numerator must be a positive integer');
  }

  if (!Number.isInteger(denominator) || denominator <= 0) {
    throw new RangeError('Meter denominator must be a positive integer');
  }

  return { numerator, denominator };
}

export function formatMeter(meter: Meter): string {
  return `${meter.numerator}/${meter.denominator}`;
}

export function metersEqual(a: Meter, b: Meter): boolean {
  return a.numerator === b.numerator && a.denominator === b.denominator;
}

export function cloneMeter(meter: Meter): Meter {
  return createMeter(meter.numerator, meter.denominator);
}
