import { BeatUnit } from './BeatUnit';
import {
  createMeter,
  defaultMeterGrouping,
  inferPulseBeatUnitFromMeter,
  inferTempoBeatUnitFromMeter,
  validateMeterGrouping,
} from './Meter';

describe('Meter grouping', () => {
  it('defaults 4/8 to 2+2', () => {
    const meter = createMeter(4, 8);
    expect(meter.grouping).toEqual([2, 2]);
  });

  it('defaults 7/8 to 3+2+2', () => {
    const meter = createMeter(7, 8);
    expect(meter.grouping).toEqual([3, 2, 2]);
  });

  it('defaults 6/8 to 3+3', () => {
    const meter = createMeter(6, 8);
    expect(meter.grouping).toEqual([3, 3]);
  });

  it('defaults simple meters to a single group', () => {
    expect(createMeter(4, 4).grouping).toEqual([4]);
    expect(createMeter(3, 4).grouping).toEqual([3]);
  });

  it('defaults /2 meters to half-note pairs', () => {
    expect(createMeter(4, 2).grouping).toEqual([2, 2]);
  });

  it('rejects grouping that does not sum to numerator', () => {
    expect(() => createMeter(7, 8, [3, 3])).toThrow(RangeError);
    expect(() => validateMeterGrouping(7, [2, 2, 2])).toThrow(RangeError);
  });

  it('accepts explicit valid grouping', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    expect(meter.grouping).toEqual([2, 2, 3]);
  });
});

describe('Meter beat-unit inference', () => {
  it('infers tempo and pulse beat units from denominator only', () => {
    const meter = createMeter(6, 8);
    expect(inferTempoBeatUnitFromMeter(meter)).toBe(BeatUnit.EIGHTH);
    expect(inferPulseBeatUnitFromMeter(meter)).toBe(BeatUnit.EIGHTH);
  });

  it('does not convert compound 6/8 to dotted quarter', () => {
    expect(inferTempoBeatUnitFromMeter(createMeter(6, 8))).toBe(BeatUnit.EIGHTH);
    expect(inferTempoBeatUnitFromMeter(createMeter(9, 8))).toBe(BeatUnit.EIGHTH);
    expect(inferTempoBeatUnitFromMeter(createMeter(12, 8))).toBe(BeatUnit.EIGHTH);
  });

  it('infers quarter pulse and tempo for 4/4', () => {
    const meter = createMeter(4, 4);
    expect(inferTempoBeatUnitFromMeter(meter)).toBe(BeatUnit.QUARTER);
    expect(inferPulseBeatUnitFromMeter(meter)).toBe(BeatUnit.QUARTER);
  });

  it('uses default grouping helper for legacy storage', () => {
    expect(defaultMeterGrouping(7, 8)).toEqual([3, 2, 2]);
  });
});
