import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_METRONOME } from '../../domain/entities/Metronome';
import { defaultAccentPatternForTimeSignature } from '../../domain/metronome/PulseGridSettings';
import {
  loadMetronomeSettings,
  normalizePersistedAccentPattern,
  normalizePersistedBpm,
  normalizePersistedFinerSubdivision,
  normalizePersistedTimeSignature,
  saveMetronomeSettings,
  type PersistedMetronomeSettings,
} from './metronomeSettingsStorage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const asyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function sampleSettings(overrides: Partial<PersistedMetronomeSettings> = {}): PersistedMetronomeSettings {
  return {
    normalClickSound: 'classic',
    accentClickSound: 'classic_accent',
    barClickSound: 'classic_bar',
    subdivisionClickSound: 'classic',
    barStartEnabled: true,
    subdivisionAccentMode: 'off',
    subdivisionAccentEveryNth: 4,
    subdivisionAccentPattern: [],
    bpm: 120,
    timeSignature: { numerator: 4, denominator: 4 },
    finerSubdivision: null,
    accentPattern: [true, false, false, false],
    ...overrides,
  };
}

describe('metronomeSettingsStorage Quick Metronome prefs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizePersistedBpm falls back to DEFAULT_METRONOME.bpm', () => {
    expect(normalizePersistedBpm(undefined)).toBe(DEFAULT_METRONOME.bpm);
    expect(normalizePersistedBpm(140)).toBe(140);
  });

  it('normalizePersistedTimeSignature falls back to DEFAULT_METRONOME.timeSignature', () => {
    expect(normalizePersistedTimeSignature(undefined)).toEqual(DEFAULT_METRONOME.timeSignature);
    expect(normalizePersistedTimeSignature({ numerator: 7, denominator: 8 })).toEqual({
      numerator: 7,
      denominator: 8,
    });
  });

  it('normalizePersistedFinerSubdivision uses normalizeFinerSubdivision / null base', () => {
    expect(normalizePersistedFinerSubdivision(undefined, 4)).toBeNull();
    expect(normalizePersistedFinerSubdivision('eighth', 4)).toBe('eighth');
    expect(normalizePersistedFinerSubdivision('not-a-kind', 4)).toBeNull();
  });

  it('normalizePersistedAccentPattern defaults, trims, and pads', () => {
    const meter = { numerator: 4, denominator: 4 };
    expect(normalizePersistedAccentPattern(undefined, meter)).toEqual(
      defaultAccentPatternForTimeSignature(meter),
    );
    expect(normalizePersistedAccentPattern([true, false], meter)).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(normalizePersistedAccentPattern([true, false, true, false, true], meter)).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('loadMetronomeSettings defaults new fields when missing from old storage', async () => {
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({
        normalClickSound: 'classic',
        bpm: 132,
      }),
    );

    const loaded = await loadMetronomeSettings();
    expect(loaded.bpm).toBe(132);
    expect(loaded.timeSignature).toEqual(DEFAULT_METRONOME.timeSignature);
    expect(loaded.finerSubdivision).toBeNull();
    expect(loaded.accentPattern).toEqual(
      defaultAccentPatternForTimeSignature(DEFAULT_METRONOME.timeSignature),
    );
  });

  it('saveMetronomeSettings and loadMetronomeSettings round-trip prefs', async () => {
    let stored: string | null = null;
    asyncStorage.setItem.mockImplementation(async (_key, value) => {
      stored = value;
    });
    asyncStorage.getItem.mockImplementation(async () => stored);

    await saveMetronomeSettings(
      sampleSettings({
        bpm: 168,
        timeSignature: { numerator: 7, denominator: 8 },
        finerSubdivision: 'sixteenth',
        accentPattern: [true, false, true, false, true, false, false],
      }),
    );
    const loaded = await loadMetronomeSettings();
    expect(loaded.bpm).toBe(168);
    expect(loaded.timeSignature).toEqual({ numerator: 7, denominator: 8 });
    expect(loaded.finerSubdivision).toBe('sixteenth');
    expect(loaded.accentPattern).toEqual([true, false, true, false, true, false, false]);
  });
});
