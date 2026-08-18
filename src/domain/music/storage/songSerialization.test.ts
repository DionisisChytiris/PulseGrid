import { BeatUnit } from '../BeatUnit';
import { ClickAccent } from '../ClickPattern';
import { DEFAULT_SONG_BPM } from '../songBpm';

import { parseStoredSongs, storedToSong, type StoredSong } from './songSerialization';

function validBar(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bar-1',
    meter: { numerator: 4, denominator: 4, grouping: [4] },
    accentPattern: { kind: 'steps', steps: [true, false, false, false] },
    repeatCount: 1,
    ...overrides,
  };
}

function validSong(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'song-a',
    name: 'Alpha',
    defaultBpm: 120,
    countInBars: 2,
    createdAt: 10,
    updatedAt: 20,
    sections: [
      {
        id: 'sec-1',
        name: 'Main',
        loop: false,
        bars: [validBar()],
      },
    ],
    ...overrides,
  };
}

describe('parseStoredSongs resilience', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('loads valid songs when one entry is corrupted', () => {
    const raw = JSON.stringify([
      validSong({ id: 'keep-me', name: 'Keep Me' }),
      { id: 'broken', name: 'Broken' },
      validSong({ id: 'also-keep', name: 'Also Keep', defaultBpm: 90 }),
    ]);

    const result = parseStoredSongs(raw);

    expect(result.unreadable).toBe(false);
    expect(result.songs.map((song) => song.id)).toEqual(['keep-me', 'also-keep']);
    expect(result.songs[1]?.defaultBpm).toBe(90);
    expect(result.skipped).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns an empty library for invalid JSON', () => {
    const result = parseStoredSongs('{not-json');

    expect(result).toEqual({ songs: [], skipped: [], unreadable: true });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns an empty library when the payload is not an array', () => {
    const result = parseStoredSongs(JSON.stringify({ id: 'song-a' }));

    expect(result.songs).toEqual([]);
    expect(result.unreadable).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('recovers unknown enum values instead of dropping the song', () => {
    const raw = JSON.stringify([
      validSong({
        id: 'enums',
        name: 'Enums',
        sections: [
          {
            id: 'sec-1',
            name: 'Main',
            loop: false,
            bars: [
              validBar({
                meter: { numerator: 6, denominator: 8, grouping: [3, 3] },
                accentPattern: { kind: 'mystery', groups: [3, 3] },
                tempoDefinition: { bpm: 141, beatUnit: 'DOTTED_WHOLE' },
                tempoTransition: 'ease-in',
                clickPattern: {
                  steps: Array.from({ length: 6 }, () => ({
                    enabled: true,
                    accent: 'forte',
                  })),
                },
              }),
            ],
          },
        ],
      }),
    ]);

    const result = parseStoredSongs(raw);
    const bar = result.songs[0]?.sections[0]?.bars[0];

    expect(result.songs).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    expect(bar?.tempoDefinition?.bpm).toBe(141);
    expect(bar?.tempoDefinition?.beatUnit).toBe(BeatUnit.EIGHTH);
    expect(bar?.tempoTransition).toBe('instant');
    expect(bar?.accentPattern.kind).toBe('grouped');
    expect(bar?.clickPattern?.steps.every((step) => step.accent === ClickAccent.Normal)).toBe(
      true,
    );
  });

  it('loads songs that omit optional fields', () => {
    const raw = JSON.stringify([
      {
        id: 'legacy-optional',
        name: 'Legacy Optional',
        sections: [
          {
            id: 'sec-1',
            name: 'Main',
            loop: false,
            bars: [
              {
                id: 'bar-1',
                meter: { numerator: 4, denominator: 4 },
                accentPattern: { kind: 'steps', steps: [true, false, false, false] },
              },
            ],
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    const result = parseStoredSongs(raw);
    const song = result.songs[0];
    const bar = song?.sections[0]?.bars[0];

    expect(result.songs).toHaveLength(1);
    expect(song?.defaultBpm).toBe(DEFAULT_SONG_BPM);
    expect(song?.countInBars).toBe(0);
    expect(bar?.repeatCount).toBe(1);
    expect(bar?.clickPattern).toBeUndefined();
    expect(bar?.tempoDefinition).toBeUndefined();
  });

  it('migrates legacy BPM-only tempo events', () => {
    const raw = JSON.stringify([
      validSong({
        id: 'legacy-tempo',
        name: 'Legacy Tempo',
        sections: [
          {
            id: 'sec-1',
            name: 'Main',
            loop: false,
            bars: [
              validBar({
                meter: { numerator: 6, denominator: 8, grouping: [3, 3] },
                tempo: { bpm: 96, type: 'linear' },
              }),
            ],
          },
        ],
      }),
    ]);

    const result = parseStoredSongs(raw);
    const bar = result.songs[0]?.sections[0]?.bars[0];

    expect(result.songs).toHaveLength(1);
    expect(bar?.tempoDefinition?.bpm).toBe(96);
    expect(bar?.tempoDefinition?.beatUnit).toBe(BeatUnit.EIGHTH);
    expect(bar?.tempoTransition).toBe('linear');
  });

  it('keeps remaining bars when one bar cannot be recovered', () => {
    const raw = JSON.stringify([
      validSong({
        id: 'partial',
        name: 'Partial',
        sections: [
          {
            id: 'sec-1',
            name: 'Main',
            loop: false,
            bars: [
              validBar({ id: 'good-bar' }),
              { id: 'bad-bar', meter: { numerator: 0, denominator: 4 } },
              validBar({ id: 'also-good', repeatCount: 2 }),
            ],
          },
        ],
      }),
    ]);

    const result = parseStoredSongs(raw);
    const bars = result.songs[0]?.sections[0]?.bars ?? [];

    expect(result.songs).toHaveLength(1);
    expect(bars.map((bar) => bar.id)).toEqual(['good-bar', 'also-good']);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not drop a valid neighbor when an entry is not an object', () => {
    const raw = JSON.stringify([validSong({ id: 'ok' }), null, 'nope', 42]);
    const result = parseStoredSongs(raw);

    expect(result.songs.map((song) => song.id)).toEqual(['ok']);
    expect(result.skipped).toHaveLength(3);
  });
});

describe('storedToSong backward compatibility', () => {
  it('still round-trips a fully specified stored song', () => {
    const stored = validSong() as StoredSong;
    const song = storedToSong(stored);

    expect(song.id).toBe('song-a');
    expect(song.name).toBe('Alpha');
    expect(song.sections[0]?.bars[0]?.meter.numerator).toBe(4);
  });
});
