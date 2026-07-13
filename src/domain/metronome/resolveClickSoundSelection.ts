import {
  type MetronomeSoundSettings,
  type ClickSoundId,
} from './ClickSoundCatalog';
import { ClickSoundType } from './ClickSoundType';
import {
  resolveClickSoundType,
  type ResolveClickSoundInput,
} from './resolveClickSound';

export type ResolvedClickSoundSelection = {
  readonly type: ClickSoundType;
  readonly soundId: ClickSoundId;
};

function resolveSoundIdForType(
  type: ClickSoundType,
  settings: MetronomeSoundSettings,
  ticksPerBeat: number,
): ClickSoundId {
  switch (type) {
    case ClickSoundType.BeatAccent:
      return settings.accentClickSound;
    case ClickSoundType.SubdivisionAccent:
      return settings.normalClickSound;
    case ClickSoundType.Normal:
      return ticksPerBeat > 1 ? settings.subdivisionClickSound : settings.normalClickSound;
    default:
      return settings.normalClickSound;
  }
}

/**
 * Given a click event and user sound settings, returns which sound should play.
 * Does not decide timing — only sound role and catalog id.
 */
export function resolveClickSoundSelection(
  event: ResolveClickSoundInput,
  settings: MetronomeSoundSettings,
): ResolvedClickSoundSelection {
  const type = resolveClickSoundType(event);
  const soundId = resolveSoundIdForType(type, settings, event.ticksPerBeat);

  return { type, soundId };
}
