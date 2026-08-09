import { downbeatAccentPattern } from './AccentPattern';
import { createBar } from './Bar';
import { createCompiledPlaybackSequence } from './compiler/CompiledPlaybackSequence';
import { createMeter } from './Meter';
import {
  DEFAULT_COUNT_IN_BARS,
  normalizeCountInBars,
  type CountInBars,
} from './countIn';
import {
  buildCountInEvents,
  buildSeamlessCountInSession,
  isCountInEvent,
  prependCountInToCompiled,
} from './playback/buildCountInPrefix';
import { createSong } from './Song';
import { createSection } from './Section';
import { songToStored, storedToSong } from './storage/songSerialization';
import type { PlaybackEvent } from './compiler/PlaybackEvent';

describe('normalizeCountInBars', () => {
  it('defaults unknown values to 2 Bars', () => {
    expect(normalizeCountInBars(undefined)).toBe(DEFAULT_COUNT_IN_BARS);
    expect(normalizeCountInBars(3)).toBe(2);
    expect(normalizeCountInBars('2')).toBe(2);
  });

  it('accepts valid options', () => {
    for (const bars of [0, 1, 2, 4] as const) {
      expect(normalizeCountInBars(bars)).toBe(bars);
    }
  });
});

describe('buildCountInEvents', () => {
  const bar = createBar({
    id: 'bar-1',
    meter: createMeter(3, 4),
    accentPattern: downbeatAccentPattern(3),
  });

  it('returns no events for None', () => {
    expect(buildCountInEvents(bar, 120, 0)).toEqual([]);
  });

  it('uses template meter, bpm, and accents', () => {
    const events = buildCountInEvents(bar, 160, 2);
    expect(events).toHaveLength(6);
    expect(events.every((event: PlaybackEvent) => event.bpm === 160)).toBe(true);
    expect(events.every((event: PlaybackEvent) => event.meter.numerator === 3)).toBe(true);
    expect(events.every((event: PlaybackEvent) => isCountInEvent(event))).toBe(true);
    expect(events[0]?.accent).toBe(true);
    expect(events[1]?.accent).toBe(false);
    expect(events[3]?.globalBarIndex).toBe(1);
    expect(events[3]?.beatIndexInBar).toBe(0);
  });
});

describe('prependCountInToCompiled', () => {
  it('places score beat 1 immediately after the final count-in beat', () => {
    const scoreSong = createSong({
      id: 's1',
      name: 'Test',
      defaultBpm: 120,
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [
            createBar({
              id: 'b1',
              meter: createMeter(4, 4),
              accentPattern: downbeatAccentPattern(4),
            }),
          ],
        }),
      ],
    });

    const scoreEvents: PlaybackEvent[] = [
      {
        sequence: 0,
        barId: 'b1',
        sectionId: 'main',
        meter: createMeter(4, 4),
        bpm: 120,
        accent: true,
        subdivisionIndex: 0,
        globalTickIndex: 0,
        source: 'song',
        repeatIndex: 0,
        beatIndexInBar: 0,
        globalBarIndex: 0,
      },
    ];
    const score = createCompiledPlaybackSequence(scoreEvents, {
      songId: scoreSong.id,
      songName: scoreSong.name,
      totalBars: 1,
      totalSections: 1,
      defaultBpm: 120,
      loopingSectionIds: [],
    });

    const countIn = buildCountInEvents(
      createBar({
        id: 'b1',
        meter: createMeter(4, 4),
        accentPattern: downbeatAccentPattern(4),
      }),
      120,
      1,
    );
    const session = prependCountInToCompiled(score, countIn);

    expect(session.events).toHaveLength(5);
    expect(isCountInEvent(session.events[3]!)).toBe(true);
    expect(isCountInEvent(session.events[4]!)).toBe(false);
    expect(session.events[4]?.barId).toBe('b1');
    expect(session.events[4]?.beatIndexInBar).toBe(0);
    expect(session.events[4]?.sequence).toBe(4);
  });
});

describe('buildSeamlessCountInSession', () => {
  it('loops after count-in without replaying preparation', () => {
    const scoreEvents: PlaybackEvent[] = Array.from({ length: 8 }, (_, index) => ({
      sequence: index,
      barId: `b${Math.floor(index / 4)}`,
      sectionId: 'main',
      meter: createMeter(4, 4),
      bpm: 100,
      accent: index % 4 === 0,
      subdivisionIndex: 0,
      globalTickIndex: index,
      source: 'song',
      repeatIndex: 0,
      beatIndexInBar: index % 4,
      globalBarIndex: Math.floor(index / 4),
    }));
    const score = createCompiledPlaybackSequence(scoreEvents, {
      songId: 's',
      songName: 'S',
      totalBars: 2,
      totalSections: 1,
      defaultBpm: 100,
      loopingSectionIds: [],
    });
    const countIn = buildCountInEvents(
      createBar({
        id: 'tmpl',
        meter: createMeter(4, 4),
        accentPattern: downbeatAccentPattern(4),
      }),
      100,
      1 as CountInBars,
    );

    const { session, loopStartIndex, countInEventCount } = buildSeamlessCountInSession(
      score,
      0,
      countIn,
    );

    expect(countInEventCount).toBe(4);
    expect(loopStartIndex).toBe(4);
    expect(isCountInEvent(session.events[0]!)).toBe(true);
    expect(isCountInEvent(session.events[loopStartIndex]!)).toBe(false);
  });
});

describe('count-in persistence', () => {
  it('round-trips countInBars; missing stored field stays None', () => {
    const song = createSong({
      id: 'new',
      name: 'New',
      sections: [],
    });
    expect(song.countInBars).toBe(2);

    const stored = songToStored(song);
    expect(stored.countInBars).toBe(2);
    expect(storedToSong(stored).countInBars).toBe(2);

    const legacyRestored = storedToSong({
      id: 'old',
      name: 'Old',
      sections: [],
      createdAt: 1,
      updatedAt: 1,
    });
    expect(legacyRestored.countInBars).toBe(0);
  });
});
