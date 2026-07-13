import { ClickSoundType } from './ClickSoundType';
import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveClickSound } from './resolveClickSound';

const accentPattern = [true, false, false, false];

describe('resolveClickSound', () => {
  it('uses beat accent on quarter-note beats', () => {
    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.BeatAccent);

    expect(
      resolveClickSound({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Normal);
  });

  it('uses only beat accent on accented beats when subdivision accent mode is off', () => {
    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.BeatAccent);

    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.Normal);

    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 2,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.Normal);
  });

  it('uses normal fills on non-accented beats when mode is off', () => {
    for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
      expect(
        resolveClickSound({
          beatIndexInBar: 1,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(ClickSoundType.Normal);
    }
  });

  it('prioritizes beat accent over group-start on accented beats', () => {
    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.BeatAccent);
  });

  it('uses subdivision accent for group starts on non-accented beats', () => {
    expect(
      resolveClickSound({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.SubdivisionAccent);

    expect(
      resolveClickSound({
        beatIndexInBar: 1,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.Normal);
  });

  it('separates beat and subdivision accents across a 4/4 triplet bar with GROUP_START', () => {
    const beat1Expected = [
      ClickSoundType.BeatAccent,
      ClickSoundType.Normal,
      ClickSoundType.Normal,
    ];
    const otherBeatExpected = [
      ClickSoundType.SubdivisionAccent,
      ClickSoundType.Normal,
      ClickSoundType.Normal,
    ];

    for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
      expect(
        resolveClickSound({
          beatIndexInBar: 0,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(beat1Expected[subdivisionIndex]);
    }

    for (let beatIndexInBar = 1; beatIndexInBar < 4; beatIndexInBar += 1) {
      for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
        expect(
          resolveClickSound({
            beatIndexInBar,
            subdivisionIndex,
            accentPattern,
            ticksPerBeat: 3,
            subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
          }),
        ).toBe(otherBeatExpected[subdivisionIndex]);
      }
    }
  });

  it('accents the first sixteenth as beat accent and uses normal fills in GROUP_START mode', () => {
    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 4,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.BeatAccent);

    for (let subdivisionIndex = 1; subdivisionIndex < 4; subdivisionIndex += 1) {
      expect(
        resolveClickSound({
          beatIndexInBar: 0,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 4,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(ClickSoundType.Normal);
    }
  });

  it('honors custom accent patterns on quarter-note grids', () => {
    const sevenEightPattern = [true, false, false, true, false, true, false];

    expect(
      resolveClickSound({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.BeatAccent);

    expect(
      resolveClickSound({
        beatIndexInBar: 3,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.BeatAccent);

    expect(
      resolveClickSound({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Normal);
  });
});
