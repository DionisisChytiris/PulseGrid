import { TRACK_HEIGHT } from './signatureTimelineConstants';
import {
  SECTION_TRACK_LABEL_COLORS,
  SECTION_TRACK_STRIP_HEIGHT,
  buildSectionColorIndexById,
  explicitSectionNavigatorEntries,
  explicitSectionNavigatorNames,
  sectionNameForBar,
  SECTION_TRACK_COLORS,
  sectionTrackColor,
  sectionTrackLabelColor,
  shouldRenderSectionStrip,
  songHasExplicitSectionVisuals,
} from './sectionTrackVisual';

describe('sectionTrackColor', () => {
  it('maps the first five sections to the documented palette', () => {
    expect(sectionTrackColor(0)).toBe(SECTION_TRACK_COLORS[0]);
    expect(sectionTrackColor(1)).toBe(SECTION_TRACK_COLORS[1]);
    expect(sectionTrackColor(2)).toBe(SECTION_TRACK_COLORS[2]);
    expect(sectionTrackColor(3)).toBe(SECTION_TRACK_COLORS[3]);
    expect(sectionTrackColor(4)).toBe(SECTION_TRACK_COLORS[4]);
  });

  it('cycles when there are more sections than colours', () => {
    expect(sectionTrackColor(5)).toBe(SECTION_TRACK_COLORS[0]);
    expect(sectionTrackColor(7)).toBe(SECTION_TRACK_COLORS[2]);
  });
});

describe('sectionTrackLabelColor', () => {
  it('maps label colours in sync with the track palette', () => {
    expect(sectionTrackLabelColor(0)).toBe(SECTION_TRACK_LABEL_COLORS[0]);
    expect(sectionTrackLabelColor(4)).toBe(SECTION_TRACK_LABEL_COLORS[4]);
    expect(sectionTrackLabelColor(6)).toBe(SECTION_TRACK_LABEL_COLORS[1]);
  });
});

describe('sectionNameForBar', () => {
  it('shows the name only on the first bar of a section start', () => {
    expect(sectionNameForBar('Intro', true, 0)).toBe('Intro');
    expect(sectionNameForBar('Intro', true, 1)).toBeNull();
    expect(sectionNameForBar('Intro', false, 0)).toBeNull();
  });

  it('does not render empty or whitespace names', () => {
    expect(sectionNameForBar('', true, 0)).toBeNull();
    expect(sectionNameForBar('   ', true, 0)).toBeNull();
  });

  it('does not render a name when section visuals are disabled', () => {
    expect(sectionNameForBar('Main', true, 0, false)).toBeNull();
    expect(sectionNameForBar('Intro', true, 0, false)).toBeNull();
  });

  it('keeps long names intact for the renderer to truncate', () => {
    const long = 'AVeryLongCustomSectionNameThatShouldTruncate';
    expect(sectionNameForBar(long, true, 0)).toBe(long);
  });
});

describe('sectionTrackVisual height constraint', () => {
  it('keeps the bottom strip inside the existing Timeline padding without growing the track', () => {
    expect(TRACK_HEIGHT).toBe(96);
    expect(SECTION_TRACK_STRIP_HEIGHT).toBeLessThanOrEqual(8);
  });
});

describe('songHasExplicitSectionVisuals', () => {
  it('treats a lone Main section as implicit (no Timeline section chrome)', () => {
    expect(songHasExplicitSectionVisuals([])).toBe(false);
    expect(songHasExplicitSectionVisuals([{ name: 'Main' }])).toBe(false);
    expect(shouldRenderSectionStrip(false)).toBe(false);
  });

  it('treats a renamed or additional section as explicit', () => {
    expect(songHasExplicitSectionVisuals([{ name: 'Intro' }])).toBe(true);
    expect(songHasExplicitSectionVisuals([{ name: 'Main' }, { name: 'Verse' }])).toBe(true);
    expect(shouldRenderSectionStrip(true)).toBe(true);
  });
});

describe('explicitSectionNavigatorNames', () => {
  it('returns no names for implicit Main-only songs', () => {
    expect(explicitSectionNavigatorNames([])).toEqual([]);
    expect(explicitSectionNavigatorNames([{ name: 'Main' }])).toEqual([]);
  });

  it('returns explicit section names and hides implicit Main', () => {
    expect(explicitSectionNavigatorNames([{ name: 'Intro' }])).toEqual(['Intro']);
    expect(
      explicitSectionNavigatorNames([
        { name: 'Main' },
        { name: 'Exercise 1' },
        { name: 'Ending' },
      ]),
    ).toEqual(['Exercise 1', 'Ending']);
  });

  it('filters empty names', () => {
    expect(explicitSectionNavigatorNames([{ name: 'Intro' }, { name: '   ' }])).toEqual(['Intro']);
  });
});

describe('explicitSectionNavigatorEntries', () => {
  it('assigns timeline-aligned colour indices and hides implicit Main', () => {
    const entries = explicitSectionNavigatorEntries([
      { id: 'main', name: 'Main', bars: [{ id: 'b1' }] },
      { id: 'intro', name: 'Intro', bars: [{ id: 'b2' }] },
      { id: 'verse', name: 'Verse', bars: [{ id: 'b3' }, { id: 'b4' }] },
    ]);

    expect(entries).toEqual([
      { name: 'Intro', colorIndex: 1 },
      { name: 'Verse', colorIndex: 2 },
    ]);
  });

  it('matches buildSectionColorIndexById for score order', () => {
    const sections = [
      { id: 'a', name: 'Intro', bars: [{ id: '1' }] },
      { id: 'b', name: 'Verse', bars: [{ id: '2' }] },
    ];
    const colorById = buildSectionColorIndexById(sections);

    expect(colorById.get('a')).toBe(0);
    expect(colorById.get('b')).toBe(1);
    expect(explicitSectionNavigatorEntries(sections)).toEqual([
      { name: 'Intro', colorIndex: 0 },
      { name: 'Verse', colorIndex: 1 },
    ]);
  });

  it('skips empty sections for colour assignment', () => {
    expect(
      explicitSectionNavigatorEntries([
        { id: 'empty', name: 'Empty', bars: [] },
        { id: 'intro', name: 'Intro', bars: [{ id: '1' }] },
      ]),
    ).toEqual([{ name: 'Intro', colorIndex: 0 }]);
  });
});
