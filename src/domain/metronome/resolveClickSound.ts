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
  /** When true (default), downbeat plays Bar. When false, only the BAR role is removed. */
  readonly barStartEnabled?: boolean;
};

function isBarStartHit(beatIndexInBar: number, subdivisionIndex: number): boolean {
  return beatIndexInBar === 0 && subdivisionIndex === 0;
}

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
 * Selects Bar / Accent / Click for a pulse.
 * Bar Start adds the BAR role on the downbeat when enabled; when disabled, beat 1 uses accent logic.
 * Domain mirror of native AccentClassification (runtime authority).
 */
export function resolveClickSoundType({
  beatIndexInBar,
  subdivisionIndex,
  accentPattern,
  ticksPerBeat,
  subdivisionAccentMode = DEFAULT_SUBDIVISION_ACCENT_MODE,
  subdivisionAccentEveryNth,
  subdivisionAccentPattern,
  barStartEnabled = true,
}: ResolveClickSoundInput): ClickSoundType {
  if (barStartEnabled && isBarStartHit(beatIndexInBar, subdivisionIndex)) {
    return ClickSoundType.Bar;
  }

  const beatIsAccented = resolveBeatAccent(beatIndexInBar, accentPattern);

  if (isBeatAccentHit(beatIsAccented, subdivisionIndex, ticksPerBeat)) {
    return ClickSoundType.Accent;
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
    return ClickSoundType.Accent;
  }

  return ClickSoundType.Click;
}
