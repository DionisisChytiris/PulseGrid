import { resolveAccentFlags } from '../AccentPattern';
import type { Bar } from '../Bar';
import {
  createCompiledPlaybackSequence,
  type CompiledPlaybackSequence,
} from '../compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../compiler/PlaybackEvent';
import type { CountInBars } from '../countIn';

export const COUNT_IN_SECTION_ID = '__countIn__';

export function countInBarId(barIndex: number): string {
  return `__countIn_bar_${barIndex}`;
}

export function isCountInEvent(event: PlaybackEvent): boolean {
  return event.source === 'countIn';
}

/**
 * Builds [barCount] preparation bars matching the musical settings of [templateBar].
 * Sequences start at 0; caller remaps when prepending to a score stream.
 */
export function buildCountInEvents(
  templateBar: Bar,
  bpm: number,
  barCount: CountInBars,
): PlaybackEvent[] {
  if (barCount === 0) {
    return [];
  }

  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('Count-in BPM must be a positive number');
  }

  const beatCount = templateBar.meter.numerator;
  const accentFlags = resolveAccentFlags(templateBar.accentPattern, beatCount);
  const events: PlaybackEvent[] = [];
  let sequence = 0;

  for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
    for (let beatIndexInBar = 0; beatIndexInBar < beatCount; beatIndexInBar += 1) {
      events.push({
        sequence,
        barId: countInBarId(barIndex),
        sectionId: COUNT_IN_SECTION_ID,
        meter: templateBar.meter,
        bpm,
        accent: accentFlags[beatIndexInBar] ?? false,
        subdivisionIndex: 0,
        globalTickIndex: sequence,
        source: 'countIn',
        repeatIndex: 0,
        beatIndexInBar,
        globalBarIndex: barIndex,
      });
      sequence += 1;
    }
  }

  return events;
}

/** Prepends count-in ticks and renumbers all sequences from zero. */
export function prependCountInToCompiled(
  score: CompiledPlaybackSequence,
  countInEvents: readonly PlaybackEvent[],
): CompiledPlaybackSequence {
  if (countInEvents.length === 0) {
    return score;
  }

  const events: PlaybackEvent[] = [
    ...countInEvents.map((event, index) => ({
      ...event,
      sequence: index,
      globalTickIndex: index,
    })),
    ...score.events.map((event, index) => ({
      ...event,
      sequence: countInEvents.length + index,
      globalTickIndex: countInEvents.length + index,
    })),
  ];

  return createCompiledPlaybackSequence(events, score.metadata);
}

/**
 * Seamless mid-start with count-in:
 * [count-in][score mid→end][full score 0→end], looping from the full-score copy
 * so the first timeline beat after count-in is the selected bar, then later
 * cycles wrap to bar 0 without repeating count-in.
 */
export function buildSeamlessCountInSession(
  score: CompiledPlaybackSequence,
  startSequence: number,
  countInEvents: readonly PlaybackEvent[],
): { session: CompiledPlaybackSequence; loopStartIndex: number; countInEventCount: number } {
  const countInEventCount = countInEvents.length;

  if (countInEventCount === 0) {
    return {
      session: score,
      loopStartIndex: 0,
      countInEventCount: 0,
    };
  }

  if (startSequence <= 0) {
    const session = prependCountInToCompiled(score, countInEvents);
    return {
      session,
      loopStartIndex: countInEventCount,
      countInEventCount,
    };
  }

  const suffix = score.events.slice(startSequence);
  const fullCycle = score.events;
  const combined: PlaybackEvent[] = [...countInEvents, ...suffix, ...fullCycle].map(
    (event, index) => ({
      ...event,
      sequence: index,
      globalTickIndex: index,
    }),
  );

  return {
    session: createCompiledPlaybackSequence(combined, score.metadata),
    loopStartIndex: countInEventCount + suffix.length,
    countInEventCount,
  };
}
