import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_METRONOME, type TimeSignature } from '../../domain/entities/Metronome';
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
  defaultAccentPatternForTimeSignature,
  normalizeFinerSubdivision,
  type FinerSubdivisionSelection,
} from '../../domain/metronome/PulseGridSettings';
import {
  normalizeSubdivisionAccentEveryNth,
  normalizeSubdivisionAccentMode,
  type SubdivisionAccentMode,
} from '../../domain/metronome/SubdivisionAccentMode';
import {
  normalizeSubdivisionAccentPattern,
  type SubdivisionAccentPattern,
} from '../../domain/metronome/SubdivisionAccentPattern';
import { clampClickVolume, DEFAULT_CLICK_VOLUMES } from '../../domain/metronome/ClickVolume';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

const STORAGE_KEY = '@pulsegrid/metronome-settings/v1';
const DEFAULT_BAR_START_ENABLED = true;

const SUBDIVISION_KINDS = new Set<SubdivisionKind>(['quarter', 'eighth', 'triplet', 'sixteenth']);

type StoredMetronomeSettings = {
  normalClickSound?: string;
  accentClickSound?: string;
  barClickSound?: string;
  subdivisionClickSound?: string;
  barStartEnabled?: boolean;
  subdivisionAccentMode?: string;
  subdivisionAccentEveryNth?: number;
  subdivisionAccentPattern?: boolean[];
  /** Quick Metronome engine BPM (same value as Redux metronome.bpm). */
  bpm?: number;
  timeSignature?: { numerator?: number; denominator?: number };
  /** UI finer subdivision; null / missing = base pulse. */
  finerSubdivision?: string | null;
  accentPattern?: boolean[];
  barBeatVolume?: number;
  accentBeatVolume?: number;
  normalBeatVolume?: number;
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
  bpm: number;
  timeSignature: TimeSignature;
  finerSubdivision: FinerSubdivisionSelection;
  accentPattern: boolean[];
  barBeatVolume: number;
  accentBeatVolume: number;
  normalBeatVolume: number;
};

export function normalizePersistedClickVolume(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return clampClickVolume(value);
}

function normalizeBarStartEnabled(value: boolean | undefined): boolean {
  return typeof value === 'boolean' ? value : DEFAULT_BAR_START_ENABLED;
}

/** Fallback: DEFAULT_METRONOME.bpm (120) when missing or invalid. */
export function normalizePersistedBpm(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_METRONOME.bpm;
  }

  return value;
}

export function normalizePersistedTimeSignature(value: unknown): TimeSignature {
  if (value === null || typeof value !== 'object') {
    return { ...DEFAULT_METRONOME.timeSignature };
  }

  const record = value as { numerator?: unknown; denominator?: unknown };
  const numerator = record.numerator;
  const denominator = record.denominator;

  if (
    typeof numerator !== 'number' ||
    typeof denominator !== 'number' ||
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return { ...DEFAULT_METRONOME.timeSignature };
  }

  return { numerator, denominator };
}

export function normalizePersistedFinerSubdivision(
  value: unknown,
  denominator: number,
): FinerSubdivisionSelection {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !SUBDIVISION_KINDS.has(value as SubdivisionKind)) {
    return null;
  }

  return normalizeFinerSubdivision(denominator, value as SubdivisionKind);
}

/**
 * Missing/empty → default for meter.
 * Wrong length → trim or pad with false.
 */
export function normalizePersistedAccentPattern(
  value: unknown,
  timeSignature: TimeSignature,
): boolean[] {
  const fallback = defaultAccentPatternForTimeSignature(timeSignature);
  const beatCount = timeSignature.numerator;

  if (!Array.isArray(value) || value.length === 0) {
    return fallback;
  }

  const bools = value.map((entry) => entry === true);

  if (bools.length === beatCount) {
    return bools;
  }

  if (bools.length > beatCount) {
    return bools.slice(0, beatCount);
  }

  return [...bools, ...Array.from({ length: beatCount - bools.length }, () => false)];
}

function toPersisted(settings: StoredMetronomeSettings | undefined): PersistedMetronomeSettings {
  const accentClickSound = normalizeAccentClickSound(settings?.accentClickSound);
  const timeSignature = normalizePersistedTimeSignature(settings?.timeSignature);
  const finerSubdivision = normalizePersistedFinerSubdivision(
    settings?.finerSubdivision,
    timeSignature.denominator,
  );

  return {
    normalClickSound: normalizeNormalClickSound(settings?.normalClickSound),
    accentClickSound,
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
    bpm: normalizePersistedBpm(settings?.bpm),
    timeSignature,
    finerSubdivision,
    accentPattern: normalizePersistedAccentPattern(settings?.accentPattern, timeSignature),
    barBeatVolume: normalizePersistedClickVolume(
      settings?.barBeatVolume,
      DEFAULT_CLICK_VOLUMES.bar,
    ),
    accentBeatVolume: normalizePersistedClickVolume(
      settings?.accentBeatVolume,
      DEFAULT_CLICK_VOLUMES.accent,
    ),
    normalBeatVolume: normalizePersistedClickVolume(
      settings?.normalBeatVolume,
      DEFAULT_CLICK_VOLUMES.normal,
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
  const timeSignature = normalizePersistedTimeSignature(settings.timeSignature);
  const finerSubdivision = normalizePersistedFinerSubdivision(
    settings.finerSubdivision,
    timeSignature.denominator,
  );

  const payload: StoredMetronomeSettings = {
    normalClickSound: settings.normalClickSound,
    accentClickSound: settings.accentClickSound,
    barClickSound: settings.barClickSound,
    subdivisionClickSound: settings.subdivisionClickSound,
    barStartEnabled: settings.barStartEnabled,
    subdivisionAccentMode: settings.subdivisionAccentMode,
    subdivisionAccentEveryNth: settings.subdivisionAccentEveryNth,
    subdivisionAccentPattern: [...settings.subdivisionAccentPattern],
    bpm: normalizePersistedBpm(settings.bpm),
    timeSignature: { ...timeSignature },
    finerSubdivision,
    accentPattern: normalizePersistedAccentPattern(settings.accentPattern, timeSignature),
    barBeatVolume: normalizePersistedClickVolume(
      settings.barBeatVolume,
      DEFAULT_CLICK_VOLUMES.bar,
    ),
    accentBeatVolume: normalizePersistedClickVolume(
      settings.accentBeatVolume,
      DEFAULT_CLICK_VOLUMES.accent,
    ),
    normalBeatVolume: normalizePersistedClickVolume(
      settings.normalBeatVolume,
      DEFAULT_CLICK_VOLUMES.normal,
    ),
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
