import {
  createAccentPatternGrouped,
  defaultAccentPatternFromMeter,
  resolveAccentFlags,
} from './AccentPattern';
import { createMeter } from './Meter';

describe('defaultAccentPatternFromMeter', () => {
  it('accents group starts for 7/8 with 2+2+3 grouping', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    const pattern = defaultAccentPatternFromMeter(meter);
    const accents = resolveAccentFlags(pattern, meter.numerator);

    expect(accents).toEqual([true, false, true, false, true, false, false]);
  });

  it('keeps seven pulse cells for 7/8', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    const accents = resolveAccentFlags(defaultAccentPatternFromMeter(meter), meter.numerator);
    expect(accents).toHaveLength(7);
  });

  it('changes accents only when grouping changes', () => {
    const meter322 = createMeter(7, 8, [3, 2, 2]);
    const meter223 = createMeter(7, 8, [2, 2, 3]);

    const accents322 = resolveAccentFlags(defaultAccentPatternFromMeter(meter322), 7);
    const accents223 = resolveAccentFlags(defaultAccentPatternFromMeter(meter223), 7);

    expect(accents322).toHaveLength(7);
    expect(accents223).toHaveLength(7);
    expect(accents322).not.toEqual(accents223);
  });
});

describe('resolveAccentFlags grouped', () => {
  it('never removes pulse cells for asymmetric grouping', () => {
    const pattern = createAccentPatternGrouped([4, 4, 3]);
    expect(resolveAccentFlags(pattern, 11)).toHaveLength(11);
  });
});
