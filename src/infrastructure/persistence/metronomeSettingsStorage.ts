import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeAccentClickSound,
  normalizeBarClickSound,
  normalizeNormalClickSound,
  normalizeSubdivisionClickSound,
  type AccentClickSoundId,
  type BarClickSoundId,
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
const DEFAULT_BAR_START_ENABLED = true;

type StoredMetronomeSettings = {
  normalClickSound?: string;
  accentClickSound?: string;
  barClickSound?: string;
  subdivisionClickSound?: string;
  barStartEnabled?: boolean;
  subdivisionAccentMode?: string;
  subdivisionAccentEveryNth?: number;
  subdivisionAccentPattern?: boolean[];
};

export type PersistedMetronomeSettings = {
  normalClickSound: NormalClickSoundId;
  accentClickSound: AccentClickSoundId;
  barClickSound: BarClickSoundId;
  subdivisionClickSound: SubdivisionClickSoundId;
  barStartEnabled: boolean;
  subdivisionAccentMode: SubdivisionAccentMode;
  subdivisionAccentEveryNth: number;
  subdivisionAccentPattern: SubdivisionAccentPattern;
};

function normalizeBarStartEnabled(value: boolean | undefined): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_BAR_START_ENABLED;
}

function toPersisted(settings: StoredMetronomeSettings | undefined): PersistedMetronomeSettings {
  const accentClickSound = normalizeAccentClickSound(settings?.accentClickSound);
  return {
    normalClickSound: normalizeNormalClickSound(settings?.normalClickSound),
    accentClickSound,
    // Missing barClickSound uses temporary Strong default (≠ classic accent).
    barClickSound: normalizeBarClickSound(settings?.barClickSound),
    subdivisionClickSound: normalizeSubdivisionClickSound(settings?.subdivisionClickSound),
    barStartEnabled: normalizeBarStartEnabled(settings?.barStartEnabled),
    subdivisionAccentMode: normalizeSubdivisionAccentMode(settings?.subdivisionAccentMode),
    subdivisionAccentEveryNth: normalizeSubdivisionAccentEveryNth(
      settings?.subdivisionAccentEveryNth,
    ),
    subdivisionAccentPattern: normalizeSubdivisionAccentPattern(
      settings?.subdivisionAccentPattern,
    ),
  };
}

export async function loadMetronomeSettings(): Promise<PersistedMetronomeSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return toPersisted(undefined);
    }

    const parsed = JSON.parse(raw) as StoredMetronomeSettings;
    return toPersisted(parsed);
  } catch {
    return toPersisted(undefined);
  }
}

export async function saveMetronomeSettings(settings: PersistedMetronomeSettings): Promise<void> {
  const payload: StoredMetronomeSettings = {
    normalClickSound: settings.normalClickSound,
    accentClickSound: settings.accentClickSound,
    barClickSound: settings.barClickSound,
    subdivisionClickSound: settings.subdivisionClickSound,
    barStartEnabled: settings.barStartEnabled,
    subdivisionAccentMode: settings.subdivisionAccentMode,
    subdivisionAccentEveryNth: settings.subdivisionAccentEveryNth,
    subdivisionAccentPattern: [...settings.subdivisionAccentPattern],
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
