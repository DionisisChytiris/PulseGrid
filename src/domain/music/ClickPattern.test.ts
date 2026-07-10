import { downbeatAccentPattern } from './AccentPattern';
import { createBar } from './Bar';
import {
  ClickAccent,
  clickPatternEnabledFlags,
  countEnabledClicks,
  createClickPattern,
  createClickStep,
  createDefaultClickPattern,
  resolveClickPattern,
  validateClickPattern,
} from './ClickPattern';
import { createMeter } from './Meter';
import { createSectionWithBars } from './Section';
import { createSong } from './Song';
import {
  serializeStoredSongs,
  storedToSong,
  songToStored,
} from './storage/songSerialization';

function enabledString(meter: ReturnType<typeof createMeter>): string {
  return clickPatternEnabledFlags(createDefaultClickPattern(meter))
    .map((enabled) => (enabled ? 'X' : '.'))
    .join('');
}

function accentString(meter: ReturnType<typeof createMeter>): string {
  return createDefaultClickPattern(meter)
    .steps.map((step) => (step.accent === ClickAccent.Accent ? 'A' : 'N'))
    .join('');
}

describe('createDefaultClickPattern', () => {
  it('enables every numerator step in 4/4 with downbeat accent', () => {
    const meter = createMeter(4, 4);
    const pattern = createDefaultClickPattern(meter);

    expect(enabledString(meter)).toBe('XXXX');
    expect(countEnabledClicks(pattern)).toBe(4);
    expect(accentString(meter)).toBe('ANNN');
  });

  it('uses grouping accents for 4/8', () => {
    const meter = createMeter(4, 8);
    expect(enabledString(meter)).toBe('XXXX');
    expect(accentString(meter)).toBe('ANAN');
  });

  it('uses grouping accents for 7/8 with 2+2+3', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    expect(enabledString(meter)).toBe('XXXXXXX');
    expect(accentString(meter)).toBe('ANANANN');
  });

  it('enables every numerator step in 4/2', () => {
    const meter = createMeter(4, 2);
    expect(enabledString(meter)).toBe('XXXX');
    expect(countEnabledClicks(createDefaultClickPattern(meter))).toBe(4);
  });

  it('enables every numerator step in 6/8', () => {
    const meter = createMeter(6, 8);
    expect(enabledString(meter)).toBe('XXXXXX');
    expect(countEnabledClicks(createDefaultClickPattern(meter))).toBe(6);
  });

  it('enables every numerator step in 6/4', () => {
    const meter = createMeter(6, 4);
    expect(enabledString(meter)).toBe('XXXXXX');
    expect(countEnabledClicks(createDefaultClickPattern(meter))).toBe(6);
  });

  it('enables every numerator step in 6/16', () => {
    const meter = createMeter(6, 16);
    expect(enabledString(meter)).toBe('XXXXXX');
    expect(countEnabledClicks(createDefaultClickPattern(meter))).toBe(6);
  });

  it('does not suppress clicks based on asymmetric grouping', () => {
    const meter = createMeter(7, 8, [2, 2, 3]);
    expect(enabledString(meter)).toBe('XXXXXXX');
    expect(countEnabledClicks(createDefaultClickPattern(meter))).toBe(7);
  });
});

describe('validateClickPattern', () => {
  it('rejects patterns whose length differs from numerator', () => {
    const meter = createMeter(4, 4);
    const pattern = createClickPattern([
      createClickStep(true),
      createClickStep(true),
      createClickStep(true),
    ]);

    expect(() => validateClickPattern(meter, pattern)).toThrow(RangeError);
  });

  it('accepts a matching pattern', () => {
    const meter = createMeter(3, 4);
    const pattern = createDefaultClickPattern(meter);
    expect(() => validateClickPattern(meter, pattern)).not.toThrow();
  });
});

describe('resolveClickPattern', () => {
  it('returns all-numerator defaults when clickPattern is absent', () => {
    const meter = createMeter(6, 8);
    const resolved = resolveClickPattern(meter, undefined);
    expect(clickPatternEnabledFlags(resolved)).toEqual([true, true, true, true, true, true]);
  });
});

describe('createBar clickPattern validation', () => {
  it('rejects invalid clickPattern on bar creation', () => {
    const meter = createMeter(4, 4);
    const pattern = createClickPattern([createClickStep(true), createClickStep(true)]);

    expect(() =>
      createBar({
        id: 'bar-1',
        meter,
        accentPattern: downbeatAccentPattern(4),
        clickPattern: pattern,
      }),
    ).toThrow(RangeError);
  });
});

describe('clickPattern serialization', () => {
  const meter = createMeter(7, 8, [2, 2, 3]);
  const pattern = createDefaultClickPattern(meter);

  const songWithPattern = createSong({
    id: 'song-1',
    name: 'Click Pattern Song',
    sections: [
      createSectionWithBars('main', 'Main', [
        createBar({
          id: 'bar-1',
          meter,
          accentPattern: downbeatAccentPattern(7),
          clickPattern: pattern,
        }),
      ]),
    ],
  });

  const legacySong = createSong({
    id: 'song-legacy',
    name: 'Legacy',
    sections: [
      createSectionWithBars('main', 'Main', [
        createBar({
          id: 'bar-1',
          meter: createMeter(4, 4),
          accentPattern: downbeatAccentPattern(4),
        }),
      ]),
    ],
  });

  it('round-trips clickPattern through storage', () => {
    const stored = songToStored(songWithPattern);
    expect(stored.sections[0]?.bars[0]?.clickPattern?.steps).toHaveLength(7);

    const restored = storedToSong(stored);
    const bar = restored.sections[0]?.bars[0];
    expect(bar?.clickPattern?.steps).toEqual(pattern.steps);
  });

  it('serializes legacy songs without clickPattern', () => {
    const stored = songToStored(legacySong);
    expect(stored.sections[0]?.bars[0]?.clickPattern).toBeUndefined();
  });

  it('deserializes legacy songs without clickPattern unchanged', () => {
    const json = serializeStoredSongs([legacySong]);
    const restored = storedToSong(JSON.parse(json)[0]);
    expect(restored.sections[0]?.bars[0]?.clickPattern).toBeUndefined();
  });

  it('resolveClickPattern supplies defaults for legacy bars', () => {
    const bar = legacySong.sections[0]?.bars[0];
    expect(bar).toBeDefined();
    if (bar === undefined) {
      return;
    }

    const resolved = resolveClickPattern(bar.meter, bar.clickPattern);
    expect(clickPatternEnabledFlags(resolved)).toEqual([true, true, true, true]);
  });
});
