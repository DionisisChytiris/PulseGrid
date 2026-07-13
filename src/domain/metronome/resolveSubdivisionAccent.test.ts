import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import {
  globalSubdivisionIndexInBar,
  resolveSubdivisionAccent,
} from './resolveSubdivisionAccent';

const customPattern = [true, false, false, true];

describe('resolveSubdivisionAccent', () => {
  it('returns false for OFF on every subdivision pulse', () => {
    for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
      expect(
        resolveSubdivisionAccent({
          beatIndexInBar: 0,
          subdivisionIndex,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
          beatIsAccented: true,
        }),
      ).toBe(false);
    }
  });

  it('accents only the first pulse of each beat in GROUP_START mode', () => {
    expect(
      resolveSubdivisionAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        beatIsAccented: false,
      }),
    ).toBe(true);

    expect(
      resolveSubdivisionAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 1,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        beatIsAccented: false,
      }),
    ).toBe(false);

    expect(
      resolveSubdivisionAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 2,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        beatIsAccented: false,
      }),
    ).toBe(false);
  });

  it('does not apply GROUP_START on quarter-note grids', () => {
    expect(
      resolveSubdivisionAccent({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        ticksPerBeat: 1,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        beatIsAccented: false,
      }),
    ).toBe(false);
  });

  it('accents every Nth subdivision from the start of the bar', () => {
    const ticksPerBeat = 2;
    const everyNth = 4;
    const expected = [true, false, false, false, true, false, false, false];

    for (let globalIndex = 0; globalIndex < expected.length; globalIndex += 1) {
      const beatIndexInBar = Math.floor(globalIndex / ticksPerBeat);
      const subdivisionIndex = globalIndex % ticksPerBeat;

      expect(
        resolveSubdivisionAccent({
          beatIndexInBar,
          subdivisionIndex,
          ticksPerBeat,
          subdivisionAccentMode: SubdivisionAccentMode.EVERY_NTH,
          subdivisionAccentEveryNth: everyNth,
          beatIsAccented: false,
        }),
      ).toBe(expected[globalIndex]);
    }
  });

  it('does not reset the EVERY_NTH counter at beat boundaries', () => {
    const ticksPerBeat = 2;
    const everyNth = 3;
    const beatsPerBar = 7;

    for (let beatIndexInBar = 0; beatIndexInBar < beatsPerBar; beatIndexInBar += 1) {
      for (let subdivisionIndex = 0; subdivisionIndex < ticksPerBeat; subdivisionIndex += 1) {
        const globalIndex = globalSubdivisionIndexInBar(
          beatIndexInBar,
          subdivisionIndex,
          ticksPerBeat,
        );
        const expected = globalIndex % everyNth === 0;

        expect(
          resolveSubdivisionAccent({
            beatIndexInBar,
            subdivisionIndex,
            ticksPerBeat,
            subdivisionAccentMode: SubdivisionAccentMode.EVERY_NTH,
            subdivisionAccentEveryNth: everyNth,
            beatIsAccented: false,
          }),
        ).toBe(expected);
      }
    }
  });

  describe('CUSTOM mode', () => {
    it('repeats the custom pattern across subdivision indexes', () => {
      const expected = [true, false, false, true, true, false, false, true];

      for (let subdivisionIndex = 0; subdivisionIndex < expected.length; subdivisionIndex += 1) {
        expect(
          resolveSubdivisionAccent({
            beatIndexInBar: 0,
            subdivisionIndex,
            ticksPerBeat: 8,
            subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
            subdivisionAccentPattern: customPattern,
            beatIsAccented: false,
          }),
        ).toBe(expected[subdivisionIndex]);
      }
    });

    it('returns false for an empty custom pattern', () => {
      expect(
        resolveSubdivisionAccent({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          ticksPerBeat: 4,
          subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
          subdivisionAccentPattern: [],
          beatIsAccented: false,
        }),
      ).toBe(false);
    });

    it('accents every subdivision when the pattern is [true]', () => {
      for (let subdivisionIndex = 1; subdivisionIndex < 4; subdivisionIndex += 1) {
        expect(
          resolveSubdivisionAccent({
            beatIndexInBar: 0,
            subdivisionIndex,
            ticksPerBeat: 4,
            subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
            subdivisionAccentPattern: [true],
            beatIsAccented: false,
          }),
        ).toBe(true);
      }
    });

    it('never accents subdivisions when the pattern is [false]', () => {
      for (let subdivisionIndex = 0; subdivisionIndex < 4; subdivisionIndex += 1) {
        expect(
          resolveSubdivisionAccent({
            beatIndexInBar: 0,
            subdivisionIndex,
            ticksPerBeat: 4,
            subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
            subdivisionAccentPattern: [false],
            beatIsAccented: false,
          }),
        ).toBe(false);
      }
    });
  });
});
