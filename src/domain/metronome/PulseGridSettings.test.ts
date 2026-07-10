import {
  cycleFinerSubdivision,
  defaultAccentPatternForTimeSignature,
  getSubdivisionAvailability,
  resolveEngineSubdivision,
  resolveTicksPerPulse,
  toDisplayBpm,
  toEngineBpm,
} from './PulseGridSettings';

describe('PulseGridSettings BPM scaling', () => {
  it('maps display BPM to engine BPM for 4/8', () => {
    expect(toEngineBpm(120, 8)).toBe(240);
    expect(toDisplayBpm(240, 8)).toBe(120);
  });

  it('maps display BPM to engine BPM for 4/2', () => {
    expect(toEngineBpm(120, 2)).toBe(60);
    expect(toDisplayBpm(60, 2)).toBe(120);
  });
});

describe('PulseGridSettings subdivisions', () => {
  it('offers finer subdivisions for denominator 4 but not quarter', () => {
    expect(getSubdivisionAvailability(4).finerSubdivisions).toEqual([
      'eighth',
      'triplet',
      'sixteenth',
    ]);
  });

  it('offers finer subdivisions for denominator 2 including quarter', () => {
    expect(getSubdivisionAvailability(2).finerSubdivisions).toEqual([
      'quarter',
      'eighth',
      'triplet',
      'sixteenth',
    ]);
  });

  it('does not offer eighth subdivision for denominator 8', () => {
    const availability = getSubdivisionAvailability(8);
    expect(availability.finerSubdivisions).not.toContain('eighth');
    expect(availability.finerSubdivisions).toContain('sixteenth');
  });

  it('disables subdivision selection for denominator 16', () => {
    const availability = getSubdivisionAvailability(16);
    expect(availability.finerSubdivisions).toEqual([]);
    expect(availability.disabledReason).toBe('Already using the finest pulse resolution.');
  });

  it('cycles base pulse and finer subdivisions', () => {
    expect(cycleFinerSubdivision(4, null)).toBe('eighth');
    expect(cycleFinerSubdivision(4, 'eighth')).toBe('triplet');
    expect(cycleFinerSubdivision(4, 'sixteenth')).toBeNull();
    expect(cycleFinerSubdivision(4, null)).toBe('eighth');
  });

  it('resolves engine ticks for finer sixteenth over eighth base grid', () => {
    expect(resolveTicksPerPulse(8, 'sixteenth')).toBe(2);
    expect(resolveEngineSubdivision(8, 'sixteenth')).toBe('eighth');
  });
});

describe('defaultAccentPatternForTimeSignature', () => {
  it('uses meter grouping for 4/8', () => {
    expect(defaultAccentPatternForTimeSignature({ numerator: 4, denominator: 8 })).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });
});
