import {
  DEFAULT_BAR_SUBDIVISION,
  isBarSubdivisionEditable,
  normalizeBarSubdivisionForMeter,
  resolveBarTicksPerPulse,
  toBarFinerSubdivision,
} from './barSubdivision';
import { createAccentPatternSteps } from './AccentPattern';
import { createBar } from './Bar';
import { createMeter } from './Meter';

function bar(
  denominator: number,
  subdivision?: 'quarter' | 'eighth' | 'triplet' | 'sixteenth',
) {
  return createBar({
    id: `b-${denominator}`,
    meter: createMeter(4, denominator),
    accentPattern: createAccentPatternSteps([true, false, false, false]),
    ...(subdivision === undefined ? {} : { subdivision }),
  });
}

describe('barSubdivision', () => {
  it('only enables subdivision editing for /2 and /4', () => {
    expect(isBarSubdivisionEditable(2)).toBe(true);
    expect(isBarSubdivisionEditable(4)).toBe(true);
    expect(isBarSubdivisionEditable(8)).toBe(false);
    expect(isBarSubdivisionEditable(16)).toBe(false);
  });

  it('defaults absent subdivision to Quarter', () => {
    expect(DEFAULT_BAR_SUBDIVISION).toBe('quarter');
    expect(toBarFinerSubdivision(4)).toBeNull();
    expect(toBarFinerSubdivision(2, 'quarter')).toBe('quarter');
  });

  it('keeps absent stored field as base pulse (no playback regression)', () => {
    expect(resolveBarTicksPerPulse(bar(4))).toBe(1);
    expect(resolveBarTicksPerPulse(bar(2))).toBe(1);
  });

  it('maps Timeline options onto Quick Metronome finer subdivisions', () => {
    expect(toBarFinerSubdivision(4, 'eighth')).toBe('eighth');
    expect(toBarFinerSubdivision(4, 'triplet')).toBe('triplet');
    expect(toBarFinerSubdivision(4, 'sixteenth')).toBe('sixteenth');
    expect(toBarFinerSubdivision(2, 'eighth')).toBe('eighth');
  });

  it('reuses Quick Metronome tick counts for /4', () => {
    expect(resolveBarTicksPerPulse(bar(4, 'eighth'))).toBe(2);
    expect(resolveBarTicksPerPulse(bar(4, 'triplet'))).toBe(3);
    expect(resolveBarTicksPerPulse(bar(4, 'sixteenth'))).toBe(4);
  });

  it('reuses Quick Metronome tick counts for /2', () => {
    expect(resolveBarTicksPerPulse(bar(2, 'quarter'))).toBe(2);
    expect(resolveBarTicksPerPulse(bar(2, 'eighth'))).toBe(4);
    expect(resolveBarTicksPerPulse(bar(2, 'triplet'))).toBe(6);
    expect(resolveBarTicksPerPulse(bar(2, 'sixteenth'))).toBe(8);
  });

  it('clears subdivision when meter is unsupported', () => {
    expect(normalizeBarSubdivisionForMeter(8, 'sixteenth')).toBeUndefined();
    expect(normalizeBarSubdivisionForMeter(4, 'eighth')).toBe('eighth');
    expect(normalizeBarSubdivisionForMeter(4, 'quarter')).toBeUndefined();
    expect(normalizeBarSubdivisionForMeter(2, 'quarter')).toBe('quarter');
  });
});
