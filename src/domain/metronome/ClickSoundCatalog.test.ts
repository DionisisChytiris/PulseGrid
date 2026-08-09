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
  });

  it('accepts valid sound ids', () => {
    expect(normalizeNormalClickSound('bright')).toBe('bright');
    expect(normalizeNormalClickSound('cowbell')).toBe('cowbell');
    expect(normalizeNormalClickSound('woodblock_medium')).toBe('woodblock_medium');
    expect(normalizeNormalClickSound('woodblock_high')).toBe('woodblock_high');
    expect(normalizeNormalClickSound('woodblock_low')).toBe('woodblock_low');
    expect(normalizeAccentClickSound('strong_accent')).toBe('strong_accent');
    expect(normalizeAccentClickSound('cowbell_accent')).toBe('cowbell_accent');
    expect(normalizeBarClickSound('digital_accent')).toBe('digital_accent');
  });

  it('uses a temporary Bar default distinct from Accent', () => {
    expect(DEFAULT_BAR_CLICK_SOUND).toBe('strong_accent');
    expect(DEFAULT_ACCENT_CLICK_SOUND).toBe('classic_accent');
    expect(DEFAULT_BAR_CLICK_SOUND).not.toBe(DEFAULT_ACCENT_CLICK_SOUND);
    expect(DEFAULT_NORMAL_CLICK_SOUND).toBe('classic');
  });
});
