import {
  DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH,
  type SubdivisionAccentMode,
} from './SubdivisionAccentMode';
import {
  DEFAULT_SUBDIVISION_ACCENT_PATTERN,
  resolveCustomSubdivisionAccent,
  type SubdivisionAccentPattern,
} from './SubdivisionAccentPattern';

export type ResolveSubdivisionAccentInput = {
  readonly beatIndexInBar: number;
  readonly subdivisionIndex: number;
  readonly ticksPerBeat: number;
  readonly subdivisionAccentMode: SubdivisionAccentMode;
  readonly subdivisionAccentEveryNth?: number;
  readonly subdivisionAccentPattern?: SubdivisionAccentPattern;
  readonly beatIsAccented: boolean;
};

/** Zero-based subdivision position from the start of the current bar. */
export function globalSubdivisionIndexInBar(
  beatIndexInBar: number,
  subdivisionIndex: number,
  ticksPerBeat: number,
): number {
  return beatIndexInBar * ticksPerBeat + subdivisionIndex;
}

/**
 * Whether subdivision accent mode adds an extra accent on top of beat accents.
 * OFF returns false — beat accents are handled separately.
 */
export function resolveSubdivisionAccent({
  beatIndexInBar,
  subdivisionIndex,
  ticksPerBeat,
  subdivisionAccentMode,
  subdivisionAccentEveryNth = DEFAULT_SUBDIVISION_ACCENT_EVERY_NTH,
  subdivisionAccentPattern = DEFAULT_SUBDIVISION_ACCENT_PATTERN,
}: ResolveSubdivisionAccentInput): boolean {
  if (ticksPerBeat <= 1 || subdivisionIndex < 0 || subdivisionIndex >= ticksPerBeat) {
    return false;
  }

  switch (subdivisionAccentMode) {
    case 'off':
      return false;
    case 'group_start':
      return subdivisionIndex === 0;
    case 'every_nth': {
      if (subdivisionAccentEveryNth <= 0) {
        return false;
      }

      const globalIndex = globalSubdivisionIndexInBar(
        beatIndexInBar,
        subdivisionIndex,
        ticksPerBeat,
      );
      return globalIndex % subdivisionAccentEveryNth === 0;
    }
    case 'custom':
      return resolveCustomSubdivisionAccent(subdivisionIndex, subdivisionAccentPattern);
    default:
      return false;
  }
}
