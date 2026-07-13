/**
 * Domain-layer tests mirroring native AccentClassification.kt / AccentClassification.swift.
 * Native playback is not exercised here — only classification logic.
 */
import { ClickSoundType } from './ClickSoundType';
import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveBeatAccent } from './resolveBeatAccent';
import { resolveClickSoundType } from './resolveClickSound';
import { resolveSubdivisionAccent } from './resolveSubdivisionAccent';
import { resolveTickAccent } from './resolveTickAccent';

const accentPattern = [true, false, false, false];

describe('AccentClassification (domain mirror)', () => {
  describe('beat accent only', () => {
    it('marks accented quarter-note beats from the accent pattern', () => {
      expect(resolveBeatAccent(0, accentPattern)).toBe(true);
      expect(resolveBeatAccent(1, accentPattern)).toBe(false);
    });

    it('resolves beat accent sound on accented beats when subdivision accent mode is off', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 1,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(ClickSoundType.BeatAccent);

      expect(
        resolveSubdivisionAccent({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
          beatIsAccented: true,
        }),
      ).toBe(false);
    });

    it('does not apply subdivision accent on non-accented triplet beats in off mode', () => {
      for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
        expect(
          resolveClickSoundType({
            beatIndexInBar: 1,
            subdivisionIndex,
            accentPattern,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.OFF,
          }),
        ).toBe(ClickSoundType.Normal);

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
  });

  describe('subdivision accent only', () => {
    it('accents only the first subdivision pulse when group start is enabled', () => {
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
    });

    it('resolves subdivision accent sound without beat accent on non-accented beats', () => {
      expect(resolveBeatAccent(1, accentPattern)).toBe(false);

      expect(
        resolveClickSoundType({
          beatIndexInBar: 1,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(ClickSoundType.SubdivisionAccent);

      expect(
        resolveTickAccent({
          beatIndexInBar: 1,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(true);
    });
  });

  describe('beat accent and subdivision accent together', () => {
    it('prioritizes beat accent sound when both apply on subdiv index 0', () => {
      expect(resolveBeatAccent(0, accentPattern)).toBe(true);
      expect(
        resolveSubdivisionAccent({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
          beatIsAccented: true,
        }),
      ).toBe(true);

      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(ClickSoundType.BeatAccent);
    });

    it('flags the tick as accented when either beat or subdivision accent applies', () => {
      expect(
        resolveTickAccent({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(true);
    });

    it('keeps distinct sound roles across an accented and non-accented beat in one bar', () => {
      const accentedBeatSounds = [
        ClickSoundType.BeatAccent,
        ClickSoundType.Normal,
        ClickSoundType.Normal,
      ];
      const nonAccentedBeatSounds = [
        ClickSoundType.SubdivisionAccent,
        ClickSoundType.Normal,
        ClickSoundType.Normal,
      ];

      for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
        expect(
          resolveClickSoundType({
            beatIndexInBar: 0,
            subdivisionIndex,
            accentPattern,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
          }),
        ).toBe(accentedBeatSounds[subdivisionIndex]);

        expect(
          resolveClickSoundType({
            beatIndexInBar: 1,
            subdivisionIndex,
            accentPattern,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
          }),
        ).toBe(nonAccentedBeatSounds[subdivisionIndex]);
      }
    });
  });

  describe('off mode', () => {
    it('never applies subdivision accent logic', () => {
      for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
        expect(
          resolveSubdivisionAccent({
            beatIndexInBar: 0,
            subdivisionIndex,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.OFF,
            beatIsAccented: subdivisionIndex === 0,
          }),
        ).toBe(false);
      }
    });

    it('accents only beat-pattern hits on subdivided grids', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(ClickSoundType.BeatAccent);

      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 1,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(ClickSoundType.Normal);
    });
  });

  describe('group start mode', () => {
    it('accents the first pulse of every beat on subdivided grids', () => {
      for (let beatIndexInBar = 0; beatIndexInBar < 4; beatIndexInBar += 1) {
        expect(
          resolveTickAccent({
            beatIndexInBar,
            subdivisionIndex: 0,
            accentPattern,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
          }),
        ).toBe(true);
      }
    });

    it('does not accent later subdivision pulses', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 2,
          subdivisionIndex: 2,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(ClickSoundType.Normal);

      expect(
        resolveTickAccent({
          beatIndexInBar: 2,
          subdivisionIndex: 2,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(false);
    });

    it('does not apply on quarter-note grids', () => {
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
  });

  describe('every nth mode', () => {
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

    it('does not reset the counter at beat boundaries in uneven meters', () => {
      const ticksPerBeat = 2;
      const everyNth = 3;
      const beatsPerBar = 7;

      for (let beatIndexInBar = 0; beatIndexInBar < beatsPerBar; beatIndexInBar += 1) {
        for (let subdivisionIndex = 0; subdivisionIndex < ticksPerBeat; subdivisionIndex += 1) {
          const globalIndex = beatIndexInBar * ticksPerBeat + subdivisionIndex;
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

    it('prioritizes beat accent sound when EVERY_NTH also applies on subdiv index 0', () => {
      expect(resolveBeatAccent(0, accentPattern)).toBe(true);

      expect(
        resolveSubdivisionAccent({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          ticksPerBeat: 2,
          subdivisionAccentMode: SubdivisionAccentMode.EVERY_NTH,
          subdivisionAccentEveryNth: 4,
          beatIsAccented: true,
        }),
      ).toBe(true);

      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 2,
          subdivisionAccentMode: SubdivisionAccentMode.EVERY_NTH,
          subdivisionAccentEveryNth: 4,
        }),
      ).toBe(ClickSoundType.BeatAccent);
    });

    it('uses subdivision accent sound on EVERY_NTH hits without beat accent', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 2,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 2,
          subdivisionAccentMode: SubdivisionAccentMode.EVERY_NTH,
          subdivisionAccentEveryNth: 4,
        }),
      ).toBe(ClickSoundType.SubdivisionAccent);
    });
  });

  describe('custom mode', () => {
    const customPattern = [true, false, false, true];

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

    it('prioritizes beat accent sound when CUSTOM also applies on subdiv index 0', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 4,
          subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
          subdivisionAccentPattern: customPattern,
        }),
      ).toBe(ClickSoundType.BeatAccent);
    });

    it('uses subdivision accent sound on CUSTOM hits without beat accent', () => {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 1,
          subdivisionIndex: 3,
          accentPattern,
          ticksPerBeat: 4,
          subdivisionAccentMode: SubdivisionAccentMode.CUSTOM,
          subdivisionAccentPattern: customPattern,
        }),
      ).toBe(ClickSoundType.SubdivisionAccent);
    });
  });
});
