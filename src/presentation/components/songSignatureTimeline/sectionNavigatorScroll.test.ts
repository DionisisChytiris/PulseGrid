import { buildTimelineSegmentViewModels } from '../../viewModels/buildTimelineSegmentViewModels';
import { createAccentPatternSteps } from '../../../domain/music/AccentPattern';
import { createBar } from '../../../domain/music/Bar';
import { createMeter, formatMeter } from '../../../domain/music/Meter';
import { createSection } from '../../../domain/music/Section';
import { createSong } from '../../../domain/music/Song';

import { firstGlobalBarIndexForNavigatorSectionIndex } from './sectionNavigatorScroll';
import {
  barStartScrollOffset,
  clampCenteredBarScrollOffset,
  segmentStride,
} from './timelineScrollGeometry';

function bar(id: string, numerator: number, denominator: number) {
  return createBar({
    id,
    meter: createMeter(numerator, denominator),
    accentPattern: createAccentPatternSteps(
      Array.from({ length: numerator }, (_, index) => index === 0),
    ),
  });
}

describe('firstGlobalBarIndexForNavigatorSectionIndex', () => {
  it('maps navigator rows in explicit-section order, skipping implicit Main', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [bar('m1', 4, 4), bar('m2', 4, 4)],
        }),
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [bar('i1', 4, 4)],
        }),
        createSection({
          id: 'verse',
          name: 'Verse',
          bars: [bar('v1', 3, 4), bar('v2', 5, 8)],
        }),
      ],
    });

    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 0)).toBe(2);
    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 1)).toBe(3);
    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 2)).toBeNull();
  });

  it('returns null for empty target sections and out-of-range indices', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({ id: 'intro', name: 'Intro', bars: [] }),
        createSection({ id: 'verse', name: 'Verse', bars: [bar('v1', 4, 4)] }),
      ],
    });

    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 0)).toBeNull();
    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 1)).toBe(0);
    expect(firstGlobalBarIndexForNavigatorSectionIndex(song.sections, -1)).toBeNull();
  });
});

describe('clampCenteredBarScrollOffset', () => {
  const viewportWidth = 400;

  function segmentsForSong(song: ReturnType<typeof createSong>) {
    return buildTimelineSegmentViewModels(song);
  }

  it('centers the first bar at offset 0 and clamps the last section start', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'a',
          name: 'Intro',
          bars: [bar('1', 4, 4), bar('2', 4, 4), bar('3', 4, 4)],
        }),
        createSection({
          id: 'b',
          name: 'Outro',
          bars: [bar('4', 4, 4), bar('5', 4, 4)],
        }),
      ],
    });
    const segments = segmentsForSong(song);

    expect(clampCenteredBarScrollOffset(segments, 0, viewportWidth)).toBe(0);

    const outroBarIndex = 3;
    const outroBarX = barStartScrollOffset(segments, outroBarIndex);
    const maxScroll =
      viewportWidth +
      segments.reduce((sum, segment) => sum + segmentStride(segment), 0) -
      viewportWidth;

    expect(clampCenteredBarScrollOffset(segments, outroBarIndex, viewportWidth)).toBe(
      Math.min(outroBarX, maxScroll),
    );
  });

  it('targets the actual first bar across changing meters within a section', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [
            bar('i1', 4, 4),
            bar('i2', 3, 4),
            bar('i3', 5, 8),
            bar('i4', 4, 4),
            bar('i5', 7, 8),
          ],
        }),
        createSection({
          id: 'ex1',
          name: 'Exercise 1',
          bars: [bar('e1', 3, 4), bar('e2', 5, 8), bar('e3', 2, 4), bar('e4', 4, 4)],
        }),
      ],
    });
    const segments = segmentsForSong(song);
    const exerciseStartBarIndex =
      firstGlobalBarIndexForNavigatorSectionIndex(song.sections, 1)!;

    expect(exerciseStartBarIndex).toBe(5);
    expect(clampCenteredBarScrollOffset(segments, exerciseStartBarIndex, viewportWidth)).toBe(
      barStartScrollOffset(segments, exerciseStartBarIndex),
    );

    // Middle bar in Intro stays left of Exercise 1 regardless of meter changes.
    expect(barStartScrollOffset(segments, 2)).toBeLessThan(
      barStartScrollOffset(segments, exerciseStartBarIndex),
    );
  });

  it('returns null when there is no scrollable timeline content', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [],
    });
    const segments = segmentsForSong(song);

    expect(clampCenteredBarScrollOffset(segments, 0, 400)).toBeNull();
    expect(clampCenteredBarScrollOffset(segments, 0, 0)).toBeNull();
  });

  it('uses variable bar widths from rendered segment geometry', () => {
    const song = createSong({
      id: 'song',
      name: 'Song',
      sections: [
        createSection({
          id: 'mixed',
          name: 'Mixed',
          bars: [bar('1', 4, 4), bar('2', 3, 4), bar('3', 5, 8)],
        }),
      ],
    });
    const segments = segmentsForSong(song);
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => segment.meter)).toEqual([
      formatMeter(createMeter(4, 4)),
      formatMeter(createMeter(3, 4)),
      formatMeter(createMeter(5, 8)),
    ]);

    expect(barStartScrollOffset(segments, 1)).toBe(segmentStride(segments[0]!));
    expect(barStartScrollOffset(segments, 2)).toBe(
      segmentStride(segments[0]!) + segmentStride(segments[1]!),
    );
  });
});
