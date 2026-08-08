import {
  DEFAULT_SONG_NAME,
  MAX_SONG_NAME_LENGTH,
  sanitizeSongName,
  sanitizeSongNameInput,
} from './songName';

describe('sanitizeSongNameInput', () => {
  it('strips invalid characters and caps length while typing', () => {
    expect(sanitizeSongNameInput('My@Song!')).toBe('MySong');
    expect(sanitizeSongNameInput('🎵 Jazz')).toBe('Jazz');
    expect(sanitizeSongNameInput('a'.repeat(30))).toHaveLength(MAX_SONG_NAME_LENGTH);
  });

  it('collapses spaces but keeps a single trailing space for the next word', () => {
    expect(sanitizeSongNameInput('My  Song')).toBe('My Song');
    expect(sanitizeSongNameInput('My ')).toBe('My ');
    expect(sanitizeSongNameInput('')).toBe('');
  });
});

describe('sanitizeSongName', () => {
  it('accepts valid names', () => {
    expect(sanitizeSongName('My Song')).toBe('My Song');
    expect(sanitizeSongName('Jazz Waltz')).toBe('Jazz Waltz');
    expect(sanitizeSongName('Practice 01')).toBe('Practice 01');
    expect(sanitizeSongName('Funk Groove 2')).toBe('Funk Groove 2');
  });

  it('strips invalid characters and normalizes spaces', () => {
    expect(sanitizeSongName('My@Song')).toBe('MySong');
    expect(sanitizeSongName('Song!')).toBe('Song');
    expect(sanitizeSongName('Rock#1')).toBe('Rock1');
    expect(sanitizeSongName('🎵 My Song')).toBe('My Song');
    expect(sanitizeSongName('  Metal   Intro  ')).toBe('Metal Intro');
  });

  it('falls back to New Timeline when empty after sanitization', () => {
    expect(sanitizeSongName('')).toBe(DEFAULT_SONG_NAME);
    expect(sanitizeSongName('   ')).toBe(DEFAULT_SONG_NAME);
    expect(sanitizeSongName('___')).toBe(DEFAULT_SONG_NAME);
    expect(sanitizeSongName('@@@')).toBe(DEFAULT_SONG_NAME);
    expect(sanitizeSongName('🎵')).toBe(DEFAULT_SONG_NAME);
  });

  it('limits to 18 characters after cleaning', () => {
    expect(sanitizeSongName('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toBe('ABCDEFGHIJKLMNOPQR');
    expect(sanitizeSongName('ABCDEFGHIJKLMNOPQRSTUVWXYZ')).toHaveLength(MAX_SONG_NAME_LENGTH);
  });
});
