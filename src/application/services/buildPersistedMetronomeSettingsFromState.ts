import type { PersistedMetronomeSettings } from '../../infrastructure/persistence/metronomeSettingsStorage';
import type { RootState } from '../../store';

/** Snapshot Redux → storage payload (settings + Quick Metronome session prefs). */
export function buildPersistedMetronomeSettingsFromState(
  state: RootState,
): PersistedMetronomeSettings {
  const { settings, metronome } = state;

  return {
    normalClickSound: settings.normalClickSound,
    accentClickSound: settings.accentClickSound,
    barClickSound: settings.barClickSound,
    subdivisionClickSound: settings.subdivisionClickSound,
    barStartEnabled: settings.barStartEnabled,
    subdivisionAccentMode: settings.subdivisionAccentMode,
    subdivisionAccentEveryNth: settings.subdivisionAccentEveryNth,
    subdivisionAccentPattern: settings.subdivisionAccentPattern,
    bpm: metronome.bpm,
    timeSignature: { ...metronome.timeSignature },
    finerSubdivision: metronome.finerSubdivision,
    accentPattern: [...metronome.accentPattern],
  };
}
