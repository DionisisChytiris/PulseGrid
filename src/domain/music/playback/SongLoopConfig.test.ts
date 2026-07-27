import {
  createEntireSongLoop,
  resolveLoopRestartBar,
  SONG_LOOP_DISABLED,
} from './SongLoopConfig';

describe('SongLoopConfig', () => {
  it('defaults to disabled entire-song loop', () => {
    expect(SONG_LOOP_DISABLED.enabled).toBe(false);
    expect(resolveLoopRestartBar(SONG_LOOP_DISABLED)).toBe(0);
  });

  it('restarts at bar 0 for entire-song loop', () => {
    expect(resolveLoopRestartBar(createEntireSongLoop(true))).toBe(0);
  });

  it('honours startBar for future bar-range loops', () => {
    expect(
      resolveLoopRestartBar({
        enabled: true,
        startBar: 4,
        endBar: 11,
      }),
    ).toBe(4);
  });
});
