import {
  createAccentPatternSteps,
  createMeter,
  createSectionWithBars,
  createSong,
  createTempoDefinitionForMeter,
} from '../../domain/music';

import {
  buildSongStatistics,
  formatAccentPatternName,
  formatEstimatedDurationNs,
} from './buildSongStatistics';

describe('formatAccentPatternName', () => {
  it('names common patterns for single-line stats labels', () => {
    expect(formatAccentPatternName([true, false, false, false])).toBe('Downbeat');
    expect(formatAccentPatternName([true, true, true, true])).toBe('All Beats');
    expect(formatAccentPatternName([false, true, false, true])).toBe('○▲○▲');
  });
});

describe('formatEstimatedDurationNs', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatEstimatedDurationNs(65_000_000_000)).toBe('1:05');
  });

  it('formats zero and invalid as 0:00', () => {
    expect(formatEstimatedDurationNs(0)).toBe('0:00');
    expect(formatEstimatedDurationNs(Number.NaN)).toBe('0:00');
  });
});

describe('buildSongStatistics', () => {
  it('summarizes structure, meters, tempo changes, and accents', () => {
    const meter44 = createMeter(4, 4);
    const meter78 = createMeter(7, 8);
    const song = createSong({
      id: 'stats-song',
      name: 'Stats Demo',
      defaultBpm: 120,
      updatedAt: Date.UTC(2026, 6, 26, 10, 0, 0),
      sections: [
        createSectionWithBars('main', 'Main', [
          {
            id: 'b1',
            meter: meter44,
            accentPattern: createAccentPatternSteps([true, false, false, false]),
          },
          {
            id: 'b2',
            meter: meter44,
            accentPattern: createAccentPatternSteps([true, false, false, false]),
          },
          {
            id: 'b3',
            meter: meter78,
            accentPattern: createAccentPatternSteps([
              true,
              false,
              false,
              true,
              false,
              true,
              false,
            ]),
            tempoDefinition: createTempoDefinitionForMeter(140, meter78),
          },
        ]),
      ],
    });

    const stats = buildSongStatistics(song);

    expect(stats.songName).toBe('Stats Demo');
    expect(stats.totalBars).toBe(3);
    expect(stats.totalSegments).toBe(2);
    expect(stats.globalBpm).toBe(120);
    expect(stats.tempoChangeCount).toBe(1);
    expect(stats.uniqueMeterCount).toBe(2);
    expect(stats.uniqueMeters).toEqual(['4/4', '7/8']);
    expect(stats.accentPatternCount).toBe(2);
    expect(stats.mostCommonAccentLabel).toBe('Downbeat');
    expect(stats.totalBeats).toBe(4 + 4 + 7);
    expect(stats.estimatedDurationLabel).not.toBe('0:00');
    expect(stats.lastModifiedLabel).not.toBeNull();
  });
});
