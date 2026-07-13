import {
  DEFAULT_ACCENT_CLICK_SOUND,
  DEFAULT_NORMAL_CLICK_SOUND,
  normalizeAccentClickSound,
  normalizeNormalClickSound,
} from './ClickSoundCatalog';

describe('ClickSoundCatalog', () => {
  it('defaults unknown values to classic sounds', () => {
    expect(normalizeNormalClickSound(undefined)).toBe(DEFAULT_NORMAL_CLICK_SOUND);
    expect(normalizeAccentClickSound(undefined)).toBe(DEFAULT_ACCENT_CLICK_SOUND);
    expect(normalizeNormalClickSound('invalid')).toBe(DEFAULT_NORMAL_CLICK_SOUND);
    expect(normalizeAccentClickSound('invalid')).toBe(DEFAULT_ACCENT_CLICK_SOUND);
  });

  it('accepts valid sound ids', () => {
    expect(normalizeNormalClickSound('bright')).toBe('bright');
    expect(normalizeNormalClickSound('cowbell')).toBe('cowbell');
    expect(normalizeAccentClickSound('strong_accent')).toBe('strong_accent');
    expect(normalizeAccentClickSound('cowbell_accent')).toBe('cowbell_accent');
  });
});
