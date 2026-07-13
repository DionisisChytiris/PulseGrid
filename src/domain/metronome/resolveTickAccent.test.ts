import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveTickAccent } from './resolveTickAccent';

const accentPattern = [true, false, false, false];

describe('resolveTickAccent', () => {
  it('accents beats from the accent pattern on quarter-note pulses', () => {
    expect(
      resolveTickAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(true);

    expect(
      resolveTickAccent({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(false);
  });

  it('accents only the first triplet pulse on accented beats when mode is off', () => {
    expect(
      resolveTickAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(true);

    expect(
      resolveTickAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(false);
  });

  it('does not accent non-accented triplet beats when mode is off', () => {
    for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
      expect(
        resolveTickAccent({
          beatIndexInBar: 1,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(false);
    }
  });

  it('accents the first pulse of every beat in GROUP_START mode', () => {
    expect(
      resolveTickAccent({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(true);

    expect(
      resolveTickAccent({
        beatIndexInBar: 1,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(false);
  });
});
