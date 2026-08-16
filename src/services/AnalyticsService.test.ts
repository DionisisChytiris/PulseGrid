import {
  MIN_PLAYBACK_DURATION_SECONDS,
  resolvePlaybackStopEvent,
} from './resolvePlaybackStopEvent';

describe('resolvePlaybackStopEvent', () => {
  it('skips when playback never started', () => {
    expect(resolvePlaybackStopEvent(null, 10_000)).toBeNull();
  });

  it('skips durations under 2 seconds', () => {
    expect(resolvePlaybackStopEvent(1000, 1999)).toBeNull();
  });

  it('returns rounded seconds when duration is at least 2 seconds', () => {
    expect(resolvePlaybackStopEvent(1000, 4500)).toEqual({ duration_seconds: 4 });
    expect(MIN_PLAYBACK_DURATION_SECONDS).toBe(2);
  });
});
