import { TRACK_HEIGHT } from './signatureTimelineConstants';
import {
  SECTION_TRACK_STRIP_HEIGHT,
  sectionNameForBar,
  SECTION_TRACK_COLORS,
  sectionTrackColor,
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
