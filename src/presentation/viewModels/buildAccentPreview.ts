import type { SongAccentPattern } from '../../domain/music/AccentPattern';

import type { AccentPreviewBeat } from './TimelineSegmentViewModel';

/** Maps domain accent pattern to ▲ / ○ preview beats (visual only). */
export function buildAccentPreview(
  pattern: SongAccentPattern,
  beatCount: number,
): AccentPreviewBeat[] {
  const flags: boolean[] = [];

  if (pattern.kind === 'steps') {
    for (let index = 0; index < beatCount; index += 1) {
      flags.push(pattern.steps[index % pattern.steps.length] ?? false);
    }
  } else {
    let beat = 0;
    const accentStarts = pattern.accentGroupStarts ?? true;

    for (const groupSize of pattern.groups) {
      if (accentStarts && beat < beatCount) {
        flags[beat] = true;
      }

      beat += groupSize;
    }

    for (let index = 0; index < beatCount; index += 1) {
      if (flags[index] === undefined) {
        flags[index] = false;
      }
    }
  }

  return flags.map((accent) => ({ symbol: accent ? 'accent' : 'beat' }));
}
