import { ClickSoundType } from './ClickSoundType';
import {
  DEFAULT_SUBDIVISION_ACCENT_MODE,
  type SubdivisionAccentMode,
} from './SubdivisionAccentMode';
import type { SubdivisionAccentPattern } from './SubdivisionAccentPattern';
import { resolveBeatAccent } from './resolveBeatAccent';
import { resolveSubdivisionAccent } from './resolveSubdivisionAccent';

export type ResolveClickSoundInput = {
  readonly beatIndexInBar: number;
  readonly subdivisionIndex: number;
  readonly accentPattern: readonly boolean[];
  readonly ticksPerBeat: number;
  readonly subdivisionAccentMode?: SubdivisionAccentMode;
  readonly subdivisionAccentEveryNth?: number;
  readonly subdivisionAccentPattern?: SubdivisionAccentPattern;
};

function isBeatAccentHit(
  beatIsAccented: boolean,
  subdivisionIndex: number,
  ticksPerBeat: number,
): boolean {
  if (!beatIsAccented) {
    return false;
  }

  if (ticksPerBeat <= 1) {
    return true;
  }

  return subdivisionIndex === 0;
}

/**
 * Selects beat-accent / subdivision-accent / normal role for a pulse.
 * Priority: beat accent pattern → subdivision accent mode → normal.
 * Timing is unchanged — this only affects which sound category plays.
 */
export function resolveClickSoundType({
  beatIndexInBar,
  subdivisionIndex,
  accentPattern,
  ticksPerBeat,
  subdivisionAccentMode = DEFAULT_SUBDIVISION_ACCENT_MODE,
  subdivisionAccentEveryNth,
  subdivisionAccentPattern,
}: ResolveClickSoundInput): ClickSoundType {
  const beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern);

  if (isBeatAccentHit(beatIsAccented, subdivisionIndex, ticksPerBeat)) {
    return ClickSoundType.BeatAccent;
  }

  if (
    resolveSubdivisionAccent({
      beatIndexInBar,
      subdivisionIndex,
      ticksPerBeat,
      subdivisionAccentMode,
      subdivisionAccentEveryNth,
      subdivisionAccentPattern,
      beatIsAccented,
    })
  ) {
    return ClickSoundType.SubdivisionAccent;
  }

  return ClickSoundType.Normal;
}
