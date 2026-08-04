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
): ClickSoundId {
  switch (type) {
    case ClickSoundType.Bar:
      return settings.barClickSound;
    case ClickSoundType.Accent:
      return settings.accentClickSound;
    case ClickSoundType.Click:
      // Subdivision fills use Click. subdivisionClickSound is retained for
      // settings/API compatibility but unused for tick playback.
      return settings.normalClickSound;
    default:
      return settings.normalClickSound;
  }
}

/**
 * Given a click event and user sound settings, returns which sound should play.
 * Does not decide timing — only sound role and catalog id.
 * Domain mirror; native classification is the runtime authority.
 */
export function resolveClickSoundSelection(
  event: ResolveClickSoundInput,
  settings: MetronomeSoundSettings,
): ResolvedClickSoundSelection {
  const type = resolveClickSoundType(event);
  const soundId = resolveSoundIdForType(type, settings);

  return { type, soundId };
}
