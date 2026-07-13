import { DEFAULT_METRONOME_SOUND_SETTINGS } from './ClickSoundCatalog';
import { ClickSoundType } from './ClickSoundType';
import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveClickSoundSelection } from './resolveClickSoundSelection';

const accentPattern = [true, false, false, false];

describe('resolveClickSoundSelection', () => {
  it('maps beat accents to the accent click setting', () => {
    expect(
      resolveClickSoundSelection(
        {
          beatIndexInBar: 0,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 1,
        },
        DEFAULT_METRONOME_SOUND_SETTINGS,
      ),
    ).toEqual({
      type: ClickSoundType.BeatAccent,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.accentClickSound,
    });
  });

  it('maps quarter-note normal beats to the normal click setting', () => {
    expect(
      resolveClickSoundSelection(
        {
          beatIndexInBar: 1,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 1,
        },
        DEFAULT_METRONOME_SOUND_SETTINGS,
      ),
    ).toEqual({
      type: ClickSoundType.Normal,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.normalClickSound,
    });
  });

  it('maps subdivision fills to the subdivision click setting', () => {
    expect(
      resolveClickSoundSelection(
        {
          beatIndexInBar: 0,
          subdivisionIndex: 1,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.OFF,
        },
        DEFAULT_METRONOME_SOUND_SETTINGS,
      ),
    ).toEqual({
      type: ClickSoundType.Normal,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.subdivisionClickSound,
    });
  });

  it('maps group-start accents to the normal click setting as the medium accent', () => {
    expect(
      resolveClickSoundSelection(
        {
          beatIndexInBar: 1,
          subdivisionIndex: 0,
          accentPattern,
          ticksPerBeat: 3,
          subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
        },
        DEFAULT_METRONOME_SOUND_SETTINGS,
      ),
    ).toEqual({
      type: ClickSoundType.SubdivisionAccent,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.normalClickSound,
    });
  });

  it('keeps beat and subdivision accents on different sound settings when combined', () => {
    const beatAccent = resolveClickSoundSelection(
      {
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      },
      DEFAULT_METRONOME_SOUND_SETTINGS,
    );

    const subdivisionAccent = resolveClickSoundSelection(
      {
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      },
      DEFAULT_METRONOME_SOUND_SETTINGS,
    );

    expect(beatAccent.type).toBe(ClickSoundType.BeatAccent);
    expect(subdivisionAccent.type).toBe(ClickSoundType.SubdivisionAccent);
    expect(beatAccent.soundId).toBe(DEFAULT_METRONOME_SOUND_SETTINGS.accentClickSound);
    expect(subdivisionAccent.soundId).toBe(DEFAULT_METRONOME_SOUND_SETTINGS.normalClickSound);
    expect(beatAccent.soundId).not.toBe(subdivisionAccent.soundId);
  });
});
