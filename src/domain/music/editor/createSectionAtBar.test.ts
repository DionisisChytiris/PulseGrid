import { createAccentPatternSteps } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';
import { createSong } from '../Song';
import { DEFAULT_SONG_NAME } from '../songName';

import { createSectionAtBar } from './createSectionAtBar';

function fourBar(id: string) {
  return createBar({
    id,
    meter: createMeter(4, 4),
    accentPattern: createAccentPatternSteps([true, false, false, false]),
  });
}

function songWithBars(barIds: string[], extraSections: ReturnType<typeof createSection>[] = []) {
  return createSong({
    id: 'song',
    name: 'Song',
    sections: [
      createSection({
        id: 'main',
        name: 'Main',
        bars: barIds.map(fourBar),
      }),
      ...extraSections,
    ],
  });
}

describe('createSectionAtBar', () => {
  it('renames the section when the bar is already a section start', () => {
    const song = songWithBars(['a', 'b', 'c']);
    const next = createSectionAtBar(song, 0, 'Intro');

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Intro');
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b', 'c']);
  });

  it('splits the owning section so the new section starts at the selected bar', () => {
    const song = songWithBars(['a', 'b', 'c', 'd']);
    const next = createSectionAtBar(song, 2, 'Chorus');

    expect(next.sections.map((section) => section.name)).toEqual(['Main', 'Chorus']);
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b']);
    expect(next.sections[1]?.bars.map((bar) => bar.id)).toEqual(['c', 'd']);
  });

  it('sanitizes custom names with the shared song-name rules', () => {
    const song = songWithBars(['a', 'b']);
    const next = createSectionAtBar(song, 1, '  My@Verse!!  ');

    expect(next.sections[1]?.name).toBe('MyVerse');
  });

  it('does not drop later existing sections', () => {
    const song = songWithBars(['a', 'b'], [
      createSection({
        id: 'verse',
        name: 'Verse',
        bars: [fourBar('c')],
      }),
    ]);

    const next = createSectionAtBar(song, 1, 'Bridge');

    expect(next.sections.map((section) => section.name)).toEqual(['Main', 'Bridge', 'Verse']);
    expect(next.sections[2]?.bars.map((bar) => bar.id)).toEqual(['c']);
  });

  it('leaves the song unchanged for an out-of-range bar', () => {
    const song = songWithBars(['a']);
    expect(createSectionAtBar(song, 4, 'Outro')).toBe(song);
  });

  it('uses the default name when the custom name is empty', () => {
    const song = songWithBars(['a', 'b']);
    const next = createSectionAtBar(song, 1, '   ');
    expect(next.sections[1]?.name).toBe(DEFAULT_SONG_NAME);
  });
});
