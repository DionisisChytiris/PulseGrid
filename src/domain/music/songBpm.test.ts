import {
  clampSongBpm,
  parseSongBpmText,
  parseSongBpmTextLenient,
  sanitizeSongBpmInput,
} from './songBpm';

describe('songBpm', () => {
  it('clamps committed values into Quick Metronome bounds', () => {
    expect(clampSongBpm(29)).toBe(30);
    expect(clampSongBpm(120)).toBe(120);
    expect(clampSongBpm(601)).toBe(600);
  });

  it('allows partial drafts below MIN while typing', () => {
    expect(sanitizeSongBpmInput('9')).toBe('9');
    expect(sanitizeSongBpmInput('95')).toBe('95');
    expect(sanitizeSongBpmInput('601')).toBe('600');
    expect(sanitizeSongBpmInput('12a3')).toBe('123');
  });

  it('only accepts complete in-range integers for live parse', () => {
    expect(parseSongBpmText('')).toBeNull();
    expect(parseSongBpmText('9')).toBeNull();
    expect(parseSongBpmText('95')).toBe(95);
    expect(parseSongBpmText('601')).toBeNull();
  });

  it('lenient parse clamps on commit', () => {
    expect(parseSongBpmTextLenient('9')).toBe(30);
    expect(parseSongBpmTextLenient('95')).toBe(95);
    expect(parseSongBpmTextLenient('999')).toBe(600);
  });
});
