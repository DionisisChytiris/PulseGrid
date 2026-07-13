import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeAccentClickSound,
  normalizeNormalClickSound,
  normalizeSubdivisionClickSound,
  type AccentClickSoundId,
  type NormalClickSoundId,
  type SubdivisionClickSoundId,
} from '../../domain/metronome/ClickSoundCatalog';
import {
  normalizeSubdivisionAccentEveryNth,
  normalizeSubdivisionAccentMode,
  type SubdivisionAccentMode,
} from '../../domain/metronome/SubdivisionAccentMode';
import {
  normalizeSubdivisionAccentPattern,
  type SubdivisionAccentPattern,
} from '../../domain/metronome/SubdivisionAccentPattern';

const STORAGE_KEY = '@pulsegrid/metronome-settings/v1';

type StoredMetronomeSettings = {
  normalClickSound?: string;
  accentClickSound?: string;
  subdivisionClickSound?: string;
  subdivisionAccentMode?: string;
  subdivisionAccentEveryNth?: number;
  subdivisionAccentPattern?: boolean[];
};

export type PersistedMetronomeSettings = {
  normalClickSound: NormalClickSoundId;
  accentClickSound: AccentClickSoundId;
  subdivisionClickSound: SubdivisionClickSoundId;
  subdivisionAccentMode: SubdivisionAccentMode;
  subdivisionAccentEveryNth: number;
  subdivisionAccentPattern: SubdivisionAccentPattern;
};

export async function loadMetronomeSettings(): Promise<PersistedMetronomeSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        normalClickSound: normalizeNormalClickSound(undefined),
        accentClickSound: normalizeAccentClickSound(undefined),
        subdivisionClickSound: normalizeSubdivisionClickSound(undefined),
        subdivisionAccentMode: normalizeSubdivisionAccentMode(undefined),
        subdivisionAccentEveryNth: normalizeSubdivisionAccentEveryNth(undefined),
        subdivisionAccentPattern: normalizeSubdivisionAccentPattern(undefined),
      };
    }

    const parsed = JSON.parse(raw) as StoredMetronomeSettings;
    return {
      normalClickSound: normalizeNormalClickSound(parsed.normalClickSound),
      accentClickSound: normalizeAccentClickSound(parsed.accentClickSound),
      subdivisionClickSound: normalizeSubdivisionClickSound(parsed.subdivisionClickSound),
      subdivisionAccentMode: normalizeSubdivisionAccentMode(parsed.subdivisionAccentMode),
      subdivisionAccentEveryNth: normalizeSubdivisionAccentEveryNth(parsed.subdivisionAccentEveryNth),
      subdivisionAccentPattern: normalizeSubdivisionAccentPattern(
        parsed.subdivisionAccentPattern,
      ),
    };
  } catch {
    return {
      normalClickSound: normalizeNormalClickSound(undefined),
      accentClickSound: normalizeAccentClickSound(undefined),
      subdivisionClickSound: normalizeSubdivisionClickSound(undefined),
      subdivisionAccentMode: normalizeSubdivisionAccentMode(undefined),
      subdivisionAccentEveryNth: normalizeSubdivisionAccentEveryNth(undefined),
      subdivisionAccentPattern: normalizeSubdivisionAccentPattern(undefined),
    };
  }
}

export async function saveMetronomeSettings(settings: PersistedMetronomeSettings): Promise<void> {
  const payload: StoredMetronomeSettings = {
    normalClickSound: settings.normalClickSound,
    accentClickSound: settings.accentClickSound,
    subdivisionClickSound: settings.subdivisionClickSound,
    subdivisionAccentMode: settings.subdivisionAccentMode,
    subdivisionAccentEveryNth: settings.subdivisionAccentEveryNth,
    subdivisionAccentPattern: [...settings.subdivisionAccentPattern],
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
