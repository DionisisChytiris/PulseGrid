import {
  DEFAULT_ACCENT_CLICK_SOUND,
  DEFAULT_BAR_CLICK_SOUND,
  DEFAULT_NORMAL_CLICK_SOUND,
  normalizeAccentClickSound,
  normalizeBarClickSound,
  normalizeNormalClickSound,
} from './ClickSoundCatalog';

describe('ClickSoundCatalog', () => {
  it('defaults unknown values to classic sounds', () => {
    expect(normalizeNormalClickSound(undefined)).toBe(DEFAULT_NORMAL_CLICK_SOUND);
    expect(normalizeAccentClickSound(undefined)).toBe(DEFAULT_ACCENT_CLICK_SOUND);
    expect(normalizeBarClickSound(undefined)).toBe(DEFAULT_BAR_CLICK_SOUND);
    expect(normalizeNormalClickSound('invalid')).toBe(DEFAULT_NORMAL_CLICK_SOUND);
    expect(normalizeAccentClickSound('invalid')).toBe(DEFAULT_ACCENT_CLICK_SOUND);
    expect(normalizeBarClickSound('invalid')).toBe(DEFAULT_BAR_CLICK_SOUND);
    expect(normalizeNormalClickSound('cowbell')).toBe(DEFAULT_NORMAL_CLICK_SOUND);
    expect(normalizeBarClickSound('strong_bar')).toBe(DEFAULT_BAR_CLICK_SOUND);
  });

  it('accepts valid sound ids', () => {
    expect(normalizeNormalClickSound('classic')).toBe('classic');
    expect(normalizeNormalClickSound('clave')).toBe('clave');
    expect(normalizeNormalClickSound('bongo')).toBe('bongo');
    expect(normalizeAccentClickSound('classic_accent')).toBe('classic_accent');
    expect(normalizeAccentClickSound('clave_accent')).toBe('clave_accent');
    expect(normalizeAccentClickSound('bongo_accent')).toBe('bongo_accent');
    expect(normalizeBarClickSound('classic_bar')).toBe('classic_bar');
    expect(normalizeBarClickSound('clave_bar')).toBe('clave_bar');
    expect(normalizeBarClickSound('bongo_bar')).toBe('bongo_bar');
  });

  it('defaults to the classic Default set', () => {
    expect(DEFAULT_NORMAL_CLICK_SOUND).toBe('classic');
    expect(DEFAULT_ACCENT_CLICK_SOUND).toBe('classic_accent');
    expect(DEFAULT_BAR_CLICK_SOUND).toBe('classic_bar');
  });
});
