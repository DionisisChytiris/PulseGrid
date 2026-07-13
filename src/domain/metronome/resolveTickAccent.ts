import {
  DEFAULT_SUBDIVISION_ACCENT_MODE,
  type SubdivisionAccentMode,
} from './SubdivisionAccentMode';
import type { SubdivisionAccentPattern } from './SubdivisionAccentPattern';
import { resolveBeatAccent } from './resolveBeatAccent';
import { resolveSubdivisionAccent } from './resolveSubdivisionAccent';

export type ResolveTickAccentInput = {
  readonly beatIndexInBar: number;
  readonly subdivisionIndex: number;
  readonly accentPattern: readonly boolean[];
  readonly ticksPerBeat: number;
  readonly subdivisionAccentMode?: SubdivisionAccentMode;
  readonly subdivisionAccentEveryNth?: number;
  readonly subdivisionAccentPattern?: SubdivisionAccentPattern;
};

/**
 * Whether this pulse should be flagged as accented (UI / tick metadata).
 * Beat accents apply on subdivision index 0; subdivision mode may add more later.
 */
export function resolveTickAccent({
  beatIndexInBar,
  subdivisionIndex,
  accentPattern,
  ticksPerBeat,
  subdivisionAccentMode = DEFAULT_SUBDIVISION_ACCENT_MODE,
  subdivisionAccentEveryNth,
  subdivisionAccentPattern,
}: ResolveTickAccentInput): boolean {
  const beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern);
  const subdivisionIsAccented = resolveSubdivisionAccent({
    beatIndexInBar,
    subdivisionIndex,
    ticksPerBeat,
    subdivisionAccentMode,
    subdivisionAccentEveryNth,
    subdivisionAccentPattern,
    beatIsAccented,
  });

  return subdivisionIsAccented || (beatIsAccented && subdivisionIndex === 0);
}
