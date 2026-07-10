import type { SongAccentPattern } from '../../domain/music/AccentPattern';

/** Flatten accent pattern to per-beat flags for UI dots (read-only preview). */
export function accentPatternToBeatFlags(pattern: SongAccentPattern, beatCount: number): boolean[] {
  if (pattern.kind === 'steps') {
    const steps = pattern.steps;
    if (steps.length >= beatCount) {
      return steps.slice(0, beatCount).map(Boolean);
    }

    return [
      ...steps.map(Boolean),
      ...Array.from({ length: beatCount - steps.length }, () => false),
    ];
  }

  const flags = Array.from({ length: beatCount }, () => false);
  let beat = 0;
  const accentStarts = pattern.accentGroupStarts ?? true;

  for (const groupSize of pattern.groups) {
    if (accentStarts && beat < beatCount) {
      flags[beat] = true;
    }

    beat += groupSize;
  }

  return flags;
}
