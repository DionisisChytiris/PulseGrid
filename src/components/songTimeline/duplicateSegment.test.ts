import { createAccentPatternSteps } from '../../domain/music/AccentPattern';
import { createBar } from '../../domain/music/Bar';
import { createMeter } from '../../domain/music/Meter';
import { createSection } from '../../domain/music/Section';
import { createSong } from '../../domain/music/Song';
import { createTempoDefinitionForMeter } from '../../domain/music/TempoDefinition';
import { createSectionAtBar } from '../../domain/music/editor/createSectionAtBar';

import { buildTimelineSegments } from './buildTimelineSegments';
import { deleteSegment, duplicateSegment } from './segmentSongMutations';

describe('duplicateSegment', () => {
  it('inserts a copy after the source and keeps same-meter regions separate', () => {
    const four = createMeter(4, 4);
    const seven = createMeter(7, 8);
    const six = createMeter(6, 8);

    const song = createSong({
      id: 'song',
      name: 'Dup',
      defaultBpm: 120,
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [
            createBar({
              id: 'a1',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'a2',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'a3',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'a4',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'b1',
              meter: seven,
              accentPattern: createAccentPatternSteps([true, false, true, false, true, false, false]),
              tempoDefinition: createTempoDefinitionForMeter(95, seven),
            }),
            createBar({
              id: 'b2',
              meter: seven,
              accentPattern: createAccentPatternSteps([true, false, true, false, true, false, false]),
              tempoDefinition: createTempoDefinitionForMeter(95, seven),
            }),
            createBar({
              id: 'b3',
              meter: seven,
              accentPattern: createAccentPatternSteps([true, false, true, false, true, false, false]),
              tempoDefinition: createTempoDefinitionForMeter(95, seven),
            }),
            createBar({
              id: 'c1',
              meter: six,
              accentPattern: createAccentPatternSteps([true, false, false, true, false, false]),
            }),
            createBar({
              id: 'c2',
              meter: six,
              accentPattern: createAccentPatternSteps([true, false, false, true, false, false]),
            }),
          ],
        }),
      ],
    });

    const before = buildTimelineSegments(song);
    expect(before.map((segment) => [segment.startBarIndex, segment.endBarIndex, segment.meterLabel])).toEqual([
      [0, 3, '4/4'],
      [4, 6, '7/8'],
      [7, 8, '6/8'],
    ]);

    const sevenSegment = before[1];
    const { song: next, duplicatedStartBarIndex } = duplicateSegment(song, sevenSegment);

    expect(duplicatedStartBarIndex).toBe(7);
    expect(next.sections[0]?.bars).toHaveLength(12);

    const sourceIds = new Set(sevenSegment.barIds);
    const inserted = next.sections[0]!.bars.slice(7, 10);
    expect(inserted).toHaveLength(3);
    for (const bar of inserted) {
      expect(sourceIds.has(bar.id)).toBe(false);
      expect(bar.meter.numerator).toBe(7);
      expect(bar.tempoDefinition?.bpm).toBe(95);
    }

    const after = buildTimelineSegments(next);
    expect(after.map((segment) => [segment.startBarIndex, segment.endBarIndex, segment.meterLabel])).toEqual([
      [0, 3, '4/4'],
      [4, 6, '7/8'],
      [7, 9, '7/8'],
      [10, 11, '6/8'],
    ]);
  });
});

describe('deleteSegment', () => {
  it('removes a middle segment and focuses the following region', () => {
    const four = createMeter(4, 4);
    const seven = createMeter(7, 8);
    const six = createMeter(6, 8);

    const song = createSong({
      id: 'song',
      name: 'Del',
      defaultBpm: 120,
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [
            createBar({
              id: 'a1',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'b1',
              meter: seven,
              accentPattern: createAccentPatternSteps([true, false, false, false, false, false, false]),
            }),
            createBar({
              id: 'b2',
              meter: seven,
              accentPattern: createAccentPatternSteps([true, false, false, false, false, false, false]),
            }),
            createBar({
              id: 'c1',
              meter: six,
              accentPattern: createAccentPatternSteps([true, false, false, false, false, false]),
            }),
          ],
        }),
      ],
    });

    const middle = buildTimelineSegments(song)[1];
    const { song: next, focusStartBarIndex, blockedReason } = deleteSegment(song, middle);

    expect(blockedReason).toBeUndefined();
    expect(focusStartBarIndex).toBe(1);
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a1', 'c1']);
    expect(buildTimelineSegments(next).map((segment) => segment.meterLabel)).toEqual(['4/4', '6/8']);
  });

  it('blocks deleting the only segment', () => {
    const four = createMeter(4, 4);
    const song = createSong({
      id: 'song',
      name: 'Solo',
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [
            createBar({
              id: 'a1',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
          ],
        }),
      ],
    });

    const only = buildTimelineSegments(song)[0];
    const result = deleteSegment(song, only);
    expect(result.blockedReason).toBe('Every timeline must contain at least one segment.');
    expect(result.song).toBe(song);
  });
});

describe('createSectionAtBar timeline segments', () => {
  it('keeps all bars visible after splitting a section', () => {
    const four = createMeter(4, 4);
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [
            createBar({
              id: 'a',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'b',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
            createBar({
              id: 'c',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
          ],
        }),
      ],
    });

    const next = createSectionAtBar(song, 1, 'Verse');
    const segments = buildTimelineSegments(next);

    expect(segments.map((segment) => segment.sectionName)).toEqual(['Main', 'Verse']);
    expect(segments.flatMap((segment) => [...segment.barIds])).toEqual(['a', 'b', 'c']);
  });

  it('includes bars from every existing song section', () => {
    const four = createMeter(4, 4);
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [
            createBar({
              id: 'a',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
          ],
        }),
        createSection({
          id: 'verse',
          name: 'Verse',
          bars: [
            createBar({
              id: 'b',
              meter: four,
              accentPattern: createAccentPatternSteps([true, false, false, false]),
            }),
          ],
        }),
      ],
    });

    const segments = buildTimelineSegments(song);
    expect(segments.map((segment) => segment.sectionName)).toEqual(['Intro', 'Verse']);
    expect(segments.flatMap((segment) => [...segment.barIds])).toEqual(['a', 'b']);
  });
});
