import { createSectionAtBar, removeSectionAtBar } from '../../domain/music/editor';
import { createAccentPatternSteps } from '../../domain/music/AccentPattern';
import { createBar } from '../../domain/music/Bar';
import { createMeter } from '../../domain/music/Meter';
import { createSection } from '../../domain/music/Section';
import { createSong } from '../../domain/music/Song';
import { createTempoDefinitionForMeter } from '../../domain/music/TempoDefinition';

import { buildTimelineSegmentViewModels } from './buildTimelineSegmentViewModels';
import {
  sectionNameForBar,
  sectionTrackColor,
  shouldRenderSectionStrip,
} from '../components/songSignatureTimeline/sectionTrackVisual';

function bar(
  id: string,
  numerator: number,
  denominator = 4,
  options: { bpm?: number; segmentBreakAfter?: boolean } = {},
) {
  const meter = createMeter(numerator, denominator);
  return createBar({
    id,
    meter,
    accentPattern: createAccentPatternSteps(
      Array.from({ length: numerator }, (_, beat) => beat === 0),
    ),
    ...(options.bpm === undefined
      ? {}
      : { tempoDefinition: createTempoDefinitionForMeter(options.bpm, meter) }),
    ...(options.segmentBreakAfter === true ? { segmentBreakAfter: true } : {}),
  });
}

describe('buildTimelineSegmentViewModels section visuals', () => {
  it('returns no regions when the song has no sections', () => {
    const song = createSong({ id: 'empty', name: 'Empty', sections: [] });
    expect(buildTimelineSegmentViewModels(song)).toEqual([]);
  });

  it('marks only the first region of a single section as the section start', () => {
    const song = createSong({
      id: 'one',
      name: 'One',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [bar('a', 4), bar('b', 4), bar('c', 4)],
        }),
      ],
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.sectionId).toBe('intro');
    expect(segments[0]?.sectionName).toBe('Intro');
    expect(segments[0]?.isSectionStart).toBe(true);
    expect(segments[0]?.showSectionVisuals).toBe(true);
    expect(segments[0]?.sectionColorIndex).toBe(0);
    expect(sectionNameForBar(
      segments[0]!.sectionName,
      segments[0]!.isSectionStart,
      0,
      segments[0]!.showSectionVisuals,
    )).toBe('Intro');
    expect(sectionNameForBar(
      segments[0]!.sectionName,
      segments[0]!.isSectionStart,
      1,
      segments[0]!.showSectionVisuals,
    )).toBeNull();
  });

  it('assigns sequential colours and names only at each section boundary', () => {
    const song = createSong({
      id: 'multi',
      name: 'Multi',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [bar('a', 4), bar('b', 4)],
        }),
        createSection({
          id: 'ex1',
          name: 'Exercise 1',
          bars: [bar('c', 4), bar('d', 4), bar('e', 4)],
        }),
        createSection({
          id: 'ex2',
          name: 'Exercise 2',
          bars: [bar('f', 3)],
        }),
      ],
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments.map((segment) => segment.sectionName)).toEqual([
      'Intro',
      'Exercise 1',
      'Exercise 2',
    ]);
    expect(segments.map((segment) => segment.isSectionStart)).toEqual([true, true, true]);
    expect(segments.every((segment) => segment.showSectionVisuals)).toBe(true);
    expect(segments.map((segment) => segment.sectionColorIndex)).toEqual([0, 1, 2]);
    expect(segments.map((segment) => segment.numberOfBars)).toEqual([2, 3, 1]);
    expect(sectionTrackColor(segments[1]!.sectionColorIndex)).not.toBe(
      sectionTrackColor(segments[0]!.sectionColorIndex),
    );
  });

  it('keeps one section colour across meter changes every bar (Delécluse-style)', () => {
    const song = createSong({
      id: 'delecluse',
      name: 'Study 10',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [bar('a', 4, 4), bar('b', 3, 4), bar('c', 5, 8)],
        }),
        createSection({
          id: 'ex1',
          name: 'Exercise 1',
          bars: [bar('d', 7, 8), bar('e', 4, 4), bar('f', 2, 4)],
        }),
      ],
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments.map((segment) => segment.meter)).toEqual([
      '4/4',
      '3/4',
      '5/8',
      '7/8',
      '4/4',
      '2/4',
    ]);
    expect(segments.map((segment) => segment.sectionId)).toEqual([
      'intro',
      'intro',
      'intro',
      'ex1',
      'ex1',
      'ex1',
    ]);
    expect(segments.map((segment) => segment.isSectionStart)).toEqual([
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(segments.map((segment) => segment.sectionColorIndex)).toEqual([0, 0, 0, 1, 1, 1]);

    const namedBars = segments.flatMap((segment) =>
      Array.from({ length: segment.numberOfBars }, (_, barIndex) =>
        sectionNameForBar(
          segment.sectionName,
          segment.isSectionStart,
          barIndex,
          segment.showSectionVisuals,
        ),
      ),
    );
    expect(namedBars).toEqual(['Intro', null, null, 'Exercise 1', null, null]);
  });

  it('does not treat a tempo change as a new section', () => {
    const song = createSong({
      id: 'tempo',
      name: 'Tempo',
      defaultBpm: 120,
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [bar('a', 4, 4, { bpm: 120 }), bar('b', 4), bar('c', 4, 4, { bpm: 80 })],
        }),
      ],
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.isSectionStart).toBe(true);
    expect(segments[0]?.showSectionVisuals).toBe(false);
    expect(segments[0]?.sectionColorIndex).toBe(0);
    expect(segments[0]?.bpmOverride).toBeNull();
  });

  it('renders no section name or strip for an implicit Main section', () => {
    const song = createSong({
      id: 'implicit',
      name: 'Implicit',
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [bar('a', 4), bar('b', 4), bar('c', 3, 4)],
        }),
      ],
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((segment) => segment.showSectionVisuals === false)).toBe(true);
    expect(segments.every((segment) => segment.sectionName === 'Main')).toBe(true);

    for (const segment of segments) {
      expect(
        sectionNameForBar(
          segment.sectionName,
          segment.isSectionStart,
          0,
          segment.showSectionVisuals,
        ),
      ).toBeNull();
      expect(shouldRenderSectionStrip(segment.showSectionVisuals)).toBe(false);
    }
  });

  it('still groups unnamed sections for colour, but hides the empty label', () => {
    const song = createSong({
      id: 'unnamed',
      name: 'Unnamed',
      sections: [
        createSection({
          id: 'blank',
          name: '   ',
          bars: [bar('a', 4), bar('b', 4)],
        }),
      ],
    });

    const [segment] = buildTimelineSegmentViewModels(song);
    expect(segment?.isSectionStart).toBe(true);
    expect(segment?.sectionColorIndex).toBe(0);
    expect(sectionNameForBar(segment!.sectionName, segment!.isSectionStart, 0, segment!.showSectionVisuals)).toBeNull();
  });

  it('cycles colour indices when a song has more than five sections', () => {
    const song = createSong({
      id: 'many',
      name: 'Many',
      sections: Array.from({ length: 6 }, (_, index) =>
        createSection({
          id: `s${index}`,
          name: `S${index + 1}`,
          bars: [bar(`b${index}`, 4)],
        }),
      ),
    });

    const segments = buildTimelineSegmentViewModels(song);
    expect(segments.map((segment) => segment.sectionColorIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(sectionTrackColor(5)).toBe(sectionTrackColor(0));
  });

  it('renders no section visuals after removing the only explicit section', () => {
    let song = createSong({
      id: 'remove',
      name: 'Remove',
      sections: [
        createSection({
          id: 'main',
          name: 'Main',
          bars: [bar('a', 4), bar('b', 4)],
        }),
      ],
    });

    song = createSectionAtBar(song, 0, 'Intro');
    let segments = buildTimelineSegmentViewModels(song);
    expect(segments[0]?.showSectionVisuals).toBe(true);

    song = removeSectionAtBar(song, 0);
    segments = buildTimelineSegmentViewModels(song);
    expect(segments[0]?.showSectionVisuals).toBe(false);
    expect(segments[0]?.sectionName).toBe('Main');
    expect(
      sectionNameForBar(
        segments[0]!.sectionName,
        segments[0]!.isSectionStart,
        0,
        segments[0]!.showSectionVisuals,
      ),
    ).toBeNull();
    expect(shouldRenderSectionStrip(segments[0]!.showSectionVisuals)).toBe(false);
  });

  it('does not change section fields while playing', () => {
    const song = createSong({
      id: 'play',
      name: 'Play',
      sections: [
        createSection({
          id: 'intro',
          name: 'Intro',
          bars: [bar('a', 4), bar('b', 4)],
        }),
        createSection({
          id: 'verse',
          name: 'Verse',
          bars: [bar('c', 3)],
        }),
      ],
    });

    const idle = buildTimelineSegmentViewModels(song);
    const playing = buildTimelineSegmentViewModels(song, {
      currentBarIndex: 2,
      isTimelineActive: true,
    });

    expect(playing.map((segment) => segment.sectionId)).toEqual(
      idle.map((segment) => segment.sectionId),
    );
    expect(playing.map((segment) => segment.isSectionStart)).toEqual(
      idle.map((segment) => segment.isSectionStart),
    );
    expect(playing.map((segment) => segment.sectionColorIndex)).toEqual(
      idle.map((segment) => segment.sectionColorIndex),
    );
    expect(playing.map((segment) => segment.sectionName)).toEqual(
      idle.map((segment) => segment.sectionName),
    );
    expect(playing.map((segment) => segment.showSectionVisuals)).toEqual(
      idle.map((segment) => segment.showSectionVisuals),
    );
  });
});
