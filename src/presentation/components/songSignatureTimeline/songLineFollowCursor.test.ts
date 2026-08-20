import {
  advanceFollowCursor,
  createFollowCursor,
  fromAbsoluteBeatPosition,
  hardSyncFollowCursorToAudio,
  maxAbsoluteBeatPosition,
  toAbsoluteBeatPosition,
  totalSongBeats,
  FOLLOW_DRIFT_CORRECT_BEATS,
  FOLLOW_DRIFT_IGNORE_BEATS,
} from './songLineFollowCursor';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';

function makeSegments(
  bars: readonly { start: number; end: number; beats: number }[],
): TimelineSegmentViewModel[] {
  return bars.map((bar, index) => ({
    id: `seg-${index}`,
    title: '',
    sectionId: 'main',
    sectionName: 'Main',
    isSectionStart: index === 0,
    sectionColorIndex: 0,
    showSectionVisuals: false,
    meter: `${bar.beats}/4`,
    numberOfBars: bar.end - bar.start + 1,
    startBar: bar.start + 1,
    endBar: bar.end + 1,
    barIndicators: [],
    accentPreview: Array.from({ length: bar.beats }, () => ({ symbol: 'beat' as const })),
    bpmOverride: null,
    subdivision: 'quarter',
    isActive: false,
    activeBarIndex: null,
  }));
}

describe('songLineFollowCursor', () => {
  const segments = makeSegments([
    { start: 0, end: 1, beats: 4 },
    { start: 2, end: 2, beats: 7 },
  ]);

  it('maps absolute positions across mixed meters', () => {
    expect(toAbsoluteBeatPosition(segments, 0, 0)).toBe(0);
    expect(toAbsoluteBeatPosition(segments, 1, 2)).toBe(6);
    expect(toAbsoluteBeatPosition(segments, 2, 0)).toBe(8);
    expect(totalSongBeats(segments)).toBe(15);

    expect(fromAbsoluteBeatPosition(segments, 6)).toEqual({
      barIndex: 1,
      beatPosition: 2,
    });
    expect(fromAbsoluteBeatPosition(segments, 8.5)).toEqual({
      barIndex: 2,
      beatPosition: 0.5,
    });
  });

  it('pins past-end absolute positions to the final beat (no last-bar wrap)', () => {
    const pinned = fromAbsoluteBeatPosition(segments, 15.5);
    expect(pinned.barIndex).toBe(2);
    expect(pinned.beatPosition).toBeCloseTo(7 - 0.0001, 4);
    expect(pinned.beatPosition).not.toBeCloseTo(0.5, 1);
  });

  it('does not loop the final bar when audioAbs keeps growing after song end', () => {
    const shortSong = makeSegments([{ start: 0, end: 1, beats: 4 }]);
    const maxAbs = maxAbsoluteBeatPosition(shortSong);
    const cursor = createFollowCursor({
      barIndex: 1,
      beatPosition: 3.0,
      beatDurationMs: 500,
      lastFrameAt: 0,
      isPlaying: true,
      audioAbsAtTick: 7,
      audioTickAt: 0,
    });

    const beats: number[] = [];
    for (let t = 16; t <= 3000; t += 16) {
      advanceFollowCursor(cursor, shortSong, t);
      beats.push(cursor.beatPosition);
    }

    expect(cursor.barIndex).toBe(1);
    expect(cursor.beatPosition).toBeCloseTo(4 - 0.0001, 3);
    expect(toAbsoluteBeatPosition(shortSong, cursor.barIndex, cursor.beatPosition)).toBeCloseTo(
      maxAbs,
      3,
    );
    // Must never wrap back near the start of the final bar after reaching the end.
    const afterEnd = beats.slice(40); // ~t>=640, past last beat
    expect(afterEnd.every((beat) => beat >= 3.5)).toBe(true);
  });

  it('does not snap when drift is within the ignore band', () => {
    const cursor = createFollowCursor({
      barIndex: 0,
      beatPosition: 1.95,
      beatDurationMs: 500,
      lastFrameAt: 1000,
      isPlaying: true,
      audioAbsAtTick: 2,
      audioTickAt: 1000,
    });

    advanceFollowCursor(cursor, segments, 1000);
    // No dt advance; drift = 2 - 1.95 = 0.05 < ignore → unchanged
    expect(cursor.beatPosition).toBeCloseTo(1.95, 4);
  });

  it('eases toward audio when drift exceeds the correct threshold', () => {
    const cursor = createFollowCursor({
      barIndex: 0,
      beatPosition: 1.0,
      beatDurationMs: 500,
      lastFrameAt: 0,
      isPlaying: true,
      audioAbsAtTick: 2,
      audioTickAt: 0,
    });

    // At t=0, audioAbs=2, visual=1, drift=1 > 0.25; with dt=16ms ease closes part of gap
    advanceFollowCursor(cursor, segments, 16);
    const abs = toAbsoluteBeatPosition(segments, cursor.barIndex, cursor.beatPosition);
    // Natural advance 16/500=0.032 → 1.032, plus ease toward 2.032
    expect(abs).toBeGreaterThan(1.032);
    expect(abs).toBeLessThan(2.0);
    expect(FOLLOW_DRIFT_CORRECT_BEATS).toBe(0.25);
    expect(FOLLOW_DRIFT_IGNORE_BEATS).toBe(0.1);
  });

  it('does not ease backward when visual is ahead of audio (late tick)', () => {
    const cursor = createFollowCursor({
      barIndex: 0,
      beatPosition: 2.5,
      beatDurationMs: 500,
      lastFrameAt: 0,
      isPlaying: true,
      audioAbsAtTick: 2.0,
      audioTickAt: 0,
    });

    advanceFollowCursor(cursor, segments, 16);
    const abs = toAbsoluteBeatPosition(segments, cursor.barIndex, cursor.beatPosition);
    // Natural advance only: 2.5 + 16/500 — no pull toward the late audio anchor.
    expect(abs).toBeCloseTo(2.532, 3);
  });

  it('crosses bar boundaries without stalling at beatsInBar - epsilon', () => {
    const cursor = createFollowCursor({
      barIndex: 0,
      beatPosition: 3.9,
      beatDurationMs: 100,
      lastFrameAt: 0,
      isPlaying: true,
      audioAbsAtTick: 3.9,
      audioTickAt: 0,
    });

    advanceFollowCursor(cursor, segments, 50); // +0.5 beats → absolute 4.4 → bar 1
    expect(cursor.barIndex).toBe(1);
    expect(cursor.beatPosition).toBeCloseTo(0.4, 4);
  });

  it('hard sync aligns visual and audio anchors', () => {
    const cursor = createFollowCursor();
    hardSyncFollowCursorToAudio(cursor, segments, 2, 3, 400, 5000);
    expect(cursor.barIndex).toBe(2);
    expect(cursor.beatPosition).toBe(3);
    expect(cursor.audioAbsAtTick).toBe(11);
    expect(cursor.audioTickAt).toBe(5000);
  });
});
