import { ClickSoundType } from './ClickSoundType';
import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveClickSoundType } from './resolveClickSound';

const accentPattern = [true, false, false, false];

describe('resolveClickSoundType', () => {
  it('uses Bar on the first pulse of the measure when Bar Start is enabled', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Bar);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Click);
  });

  it('uses only Bar or Accent on accented beats when subdivision accent mode is off', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.Bar);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.Click);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 2,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.OFF,
      }),
    ).toBe(ClickSoundType.Click);
  });

  it('uses Click fills on non-accented beats when mode is off', () => {
    for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 1,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        }),
      ).toBe(ClickSoundType.Click);
    }
  });

  it('prioritizes Bar over group-start on the downbeat', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.Bar);
  });

  it('uses Accent for group starts on non-downbeat beats', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.Accent);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 1,
        subdivisionIndex: 1,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.Click);
  });

  it('separates Bar, Accent, and Click across a 4/4 triplet bar with GROUP_START', () => {
    const beat1Expected = [
      ClickSoundType.Bar,
      ClickSoundType.Click,
      ClickSoundType.Click,
    ];
    const otherBeatExpected = [
      ClickSoundType.Accent,
      ClickSoundType.Click,
      ClickSoundType.Click,
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
      ).toBe(beat1Expected[subdivisionIndex]);
    }

    for (let beatIndexInBar = 1; beatIndexInBar < 4; beatIndexInBar += 1) {
      for (let subdivisionIndex = 0; subdivisionIndex < 3; subdivisionIndex += 1) {
        expect(
          resolveClickSoundType({
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

  it('accents the first sixteenth as Bar and uses Click fills in GROUP_START mode', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 4,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      }),
    ).toBe(ClickSoundType.Bar);

    for (let subdivisionIndex = 1; subdivisionIndex < 4; subdivisionIndex += 1) {
      expect(
        resolveClickSoundType({
          beatIndexInBar: 0,
          subdivisionIndex,
          accentPattern,
          ticksPerBeat: 4,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        }),
      ).toBe(ClickSoundType.Click);
    }
  });

  it('honors custom accent patterns on quarter-note grids', () => {
    const sevenEightPattern = [true, false, false, true, false, true, false];

    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Bar);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 3,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Accent);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern: sevenEightPattern,
        ticksPerBeat: 1,
      }),
    ).toBe(ClickSoundType.Click);
  });

  it('lets beat 1 follow accent logic when Bar Start is disabled', () => {
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 1,
        barStartEnabled: false,
      }),
    ).toBe(ClickSoundType.Accent);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern: [false, true, false, false],
        ticksPerBeat: 1,
        barStartEnabled: false,
      }),
    ).toBe(ClickSoundType.Click);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 3,
        subdivisionIndex: 0,
        accentPattern: [true, false, false, true, false, true, false],
        ticksPerBeat: 1,
        barStartEnabled: false,
      }),
    ).toBe(ClickSoundType.Accent);

    expect(
      resolveClickSoundType({
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        barStartEnabled: false,
      }),
    ).toBe(ClickSoundType.Accent);

    // Subdivision accents may still apply on beat 1 when Bar Start is off.
    expect(
      resolveClickSoundType({
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern: [false, false, false, false],
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        barStartEnabled: false,
      }),
    ).toBe(ClickSoundType.Accent);
  });
});
