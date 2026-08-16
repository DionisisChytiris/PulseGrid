import { DEFAULT_METRONOME_SOUND_SETTINGS } from './ClickSoundCatalog';
import { ClickSoundType } from './ClickSoundType';
import { SubdivisionAccentMode } from './SubdivisionAccentMode';
import { resolveClickSoundSelection } from './resolveClickSoundSelection';

const accentPattern = [true, false, false, false];

describe('resolveClickSoundSelection', () => {
  it('maps Bar to the bar click setting', () => {
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
      type: ClickSoundType.Bar,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.barClickSound,
    });
  });

  it('maps quarter-note unaccented beats to the Click (normal) setting', () => {
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
      type: ClickSoundType.Click,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.normalClickSound,
    });
  });

  it('maps subdivision fills to the Click (normal) setting', () => {
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
      type: ClickSoundType.Click,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.normalClickSound,
    });
  });

  it('maps group-start accents to the accent click setting', () => {
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
      type: ClickSoundType.Accent,
      soundId: DEFAULT_METRONOME_SOUND_SETTINGS.accentClickSound,
    });
  });

  it('keeps Bar and Accent as distinct roles with independent sample banks', () => {
    const settings = {
      ...DEFAULT_METRONOME_SOUND_SETTINGS,
      barClickSound: 'clave_bar' as const,
      accentClickSound: 'classic_accent' as const,
    };

    const bar = resolveClickSoundSelection(
      {
        beatIndexInBar: 0,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      },
      settings,
    );

    const accent = resolveClickSoundSelection(
      {
        beatIndexInBar: 1,
        subdivisionIndex: 0,
        accentPattern,
        ticksPerBeat: 3,
        subdivisionAccentMode: SubdivisionAccentMode.GROUP_START,
      },
      settings,
    );

    expect(bar.type).toBe(ClickSoundType.Bar);
    expect(accent.type).toBe(ClickSoundType.Accent);
    expect(bar.soundId).toBe('clave_bar');
    expect(accent.soundId).toBe('classic_accent');
  });
});
