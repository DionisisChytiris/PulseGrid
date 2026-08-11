import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';

/** Ignore tiny drift — smooth motion over perfect alignment. */
export const FOLLOW_DRIFT_IGNORE_BEATS = 0.1;
/** Soft-correct only when drift exceeds this (beats). */
export const FOLLOW_DRIFT_CORRECT_BEATS = 0.25;
/** Time constant for asymptotic ease toward audio when correcting. */
export const FOLLOW_EASE_TAU_MS = 90;

/** Keep the cursor just inside the final beat (never wrap past song end). */
const FINAL_BEAT_EPSILON = 0.0001;

export type FollowCursorState = {
  barIndex: number;
  /** Continuous beat position within the current bar (may briefly exceed bar length before normalize). */
  beatPosition: number;
  beatDurationMs: number;
  lastFrameAt: number;
  isPlaying: boolean;
  /** Absolute beat index at last audio tick (beat start). */
  audioAbsAtTick: number;
  audioTickAt: number;
};

/** Total primary beats across all Song Line segments. */
export function totalSongBeats(
  segments: readonly TimelineSegmentViewModel[],
): number {
  let total = 0;

  for (const segment of segments) {
    const perBar = Math.max(1, segment.accentPreview.length);
    const barCount = Math.max(0, segment.endBar - segment.startBar + 1);
    total += barCount * perBar;
  }

  return total;
}

/** Inclusive max absolute position (final beat of the final bar). */
export function maxAbsoluteBeatPosition(
  segments: readonly TimelineSegmentViewModel[],
): number {
  return Math.max(0, totalSongBeats(segments) - FINAL_BEAT_EPSILON);
}

/** Song-absolute beat position (0 at start of first bar). */
export function toAbsoluteBeatPosition(
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  beatPosition: number,
): number {
  let absolute = 0;

  for (const segment of segments) {
    const start = segment.startBar - 1;
    const end = segment.endBar - 1;
    const perBar = Math.max(1, segment.accentPreview.length);

    for (let bar = start; bar <= end; bar += 1) {
      if (bar < barIndex) {
        absolute += perBar;
      } else if (bar === barIndex) {
        return absolute + beatPosition;
      } else {
        return absolute;
      }
    }
  }

  return absolute + beatPosition;
}

/** Convert absolute beat position back to bar + in-bar beat (supports bar crossings). */
export function fromAbsoluteBeatPosition(
  segments: readonly TimelineSegmentViewModel[],
  absoluteBeat: number,
): { barIndex: number; beatPosition: number } {
  let remaining = Math.max(0, absoluteBeat);
  let lastBar = 0;
  let lastPerBar = 4;

  for (const segment of segments) {
    const start = segment.startBar - 1;
    const end = segment.endBar - 1;
    const perBar = Math.max(1, segment.accentPreview.length);

    for (let bar = start; bar <= end; bar += 1) {
      lastBar = bar;
      lastPerBar = perBar;
      if (remaining < perBar) {
        return { barIndex: bar, beatPosition: remaining };
      }
      remaining -= perBar;
    }
  }

  // Past song end: pin to the final beat of the final bar (never wrap to beat 0).
  return {
    barIndex: lastBar,
    beatPosition: Math.max(0, lastPerBar - FINAL_BEAT_EPSILON),
  };
}

export function createFollowCursor(
  partial?: Partial<FollowCursorState>,
): FollowCursorState {
  return {
    barIndex: 0,
    beatPosition: 0,
    beatDurationMs: 500,
    lastFrameAt: 0,
    isPlaying: false,
    audioAbsAtTick: 0,
    audioTickAt: 0,
    ...partial,
  };
}

/**
 * Advance the visual transport cursor for one frame.
 * Audio remains master via tick anchors; visual only eases when it lags behind
 * (never ease backward after a late tick).
 */
export function advanceFollowCursor(
  cursor: FollowCursorState,
  segments: readonly TimelineSegmentViewModel[],
  now: number,
): void {
  const dtMs = Math.max(0, now - cursor.lastFrameAt);
  cursor.lastFrameAt = now;

  if (!cursor.isPlaying || cursor.beatDurationMs <= 0) {
    return;
  }

  const maxAbs = maxAbsoluteBeatPosition(segments);

  let visualAbs = toAbsoluteBeatPosition(
    segments,
    cursor.barIndex,
    cursor.beatPosition,
  );
  visualAbs += dtMs / cursor.beatDurationMs;

  const audioAbs = Math.min(
    maxAbs,
    cursor.audioAbsAtTick + (now - cursor.audioTickAt) / cursor.beatDurationMs,
  );
  const drift = audioAbs - visualAbs;

  // Soft-correct only when visual lags behind audio. Never pull backward
  // after a late tick (that caused a micro pause at each beat).
  if (drift > FOLLOW_DRIFT_CORRECT_BEATS) {
    const alpha = 1 - Math.exp(-dtMs / FOLLOW_EASE_TAU_MS);
    visualAbs += drift * alpha;
  }

  visualAbs = Math.min(visualAbs, maxAbs);

  const normalized = fromAbsoluteBeatPosition(segments, visualAbs);
  cursor.barIndex = normalized.barIndex;
  cursor.beatPosition = normalized.beatPosition;
}

/**
 * Record an audio tick without snapping the visual cursor.
 * Updates the master-clock anchor used for drift estimation.
 */
export function applyAudioTickToFollowCursor(
  cursor: FollowCursorState,
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  beatIndexInBar: number,
  beatDurationMs: number,
  now: number,
): void {
  cursor.beatDurationMs = beatDurationMs;
  cursor.audioAbsAtTick = Math.min(
    maxAbsoluteBeatPosition(segments),
    toAbsoluteBeatPosition(segments, barIndex, Math.max(0, beatIndexInBar)),
  );
  cursor.audioTickAt = now;
}

export function hardSyncFollowCursorToAudio(
  cursor: FollowCursorState,
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  beatIndexInBar: number,
  beatDurationMs: number,
  now: number,
): void {
  const beatPosition = Math.max(0, beatIndexInBar);
  const maxAbs = maxAbsoluteBeatPosition(segments);
  const absolute = Math.min(
    maxAbs,
    toAbsoluteBeatPosition(segments, barIndex, beatPosition),
  );
  const normalized = fromAbsoluteBeatPosition(segments, absolute);

  cursor.barIndex = normalized.barIndex;
  cursor.beatPosition = normalized.beatPosition;
  cursor.beatDurationMs = beatDurationMs;
  cursor.lastFrameAt = now;
  cursor.isPlaying = true;
  cursor.audioAbsAtTick = absolute;
  cursor.audioTickAt = now;
}

/** Scroll geometry: allow beatPosition to spill into later bars (no end-of-bar stall). */
export function followScrollBeatPosition(
  segments: readonly TimelineSegmentViewModel[],
  barIndex: number,
  beatPosition: number,
): { barIndex: number; beatPosition: number } {
  return fromAbsoluteBeatPosition(
    segments,
    Math.min(
      maxAbsoluteBeatPosition(segments),
      toAbsoluteBeatPosition(segments, barIndex, beatPosition),
    ),
  );
}
