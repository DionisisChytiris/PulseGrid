import { createAccentPatternSteps } from '../AccentPattern';
import { createBar } from '../Bar';
import { createMeter } from '../Meter';
import { createSection } from '../Section';
import { createSong } from '../Song';

import { createSectionAtBar, removeSectionAtBar } from './createSectionAtBar';

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

describe('removeSectionAtBar', () => {
  it('reverts a lone explicit section back to implicit Main', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c']), 0, 'Intro');
    const next = removeSectionAtBar(song, 0);

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Main');
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op for implicit Main on a lone section', () => {
    const song = songWithBars(['a', 'b']);
    expect(removeSectionAtBar(song, 0)).toBe(song);
  });

  it('merges the first section into the next section', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c', 'd']), 1, 'Verse');
    const next = removeSectionAtBar(song, 0);

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Verse');
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('merges a middle section into the previous section', () => {
    let song = createSectionAtBar(songWithBars(['a', 'b', 'c', 'd']), 1, 'Bridge');
    song = createSectionAtBar(song, 3, 'Outro');

    const next = removeSectionAtBar(song, 1);

    expect(next.sections.map((section) => section.name)).toEqual(['Main', 'Outro']);
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b', 'c']);
    expect(next.sections[1]?.bars.map((bar) => bar.id)).toEqual(['d']);
  });

  it('merges the last section into the previous section', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c']), 1, 'Verse');
    const next = removeSectionAtBar(song, 1);

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Main');
    expect(next.sections[0]?.bars.map((bar) => bar.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes a preset section created at the current bar', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c']), 0, 'Intro');
    const next = removeSectionAtBar(song, 0);

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Main');
  });

  it('removes a custom section created at the current bar', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c']), 0, 'Delécluse 10');
    const next = removeSectionAtBar(song, 0);

    expect(next.sections).toHaveLength(1);
    expect(next.sections[0]?.name).toBe('Main');
  });

  it('does nothing when the bar is not a section start', () => {
    const song = createSectionAtBar(songWithBars(['a', 'b', 'c']), 1, 'Verse');
    expect(removeSectionAtBar(song, 2)).toBe(song);
  });

  it('does nothing for an out-of-range bar', () => {
    const song = songWithBars(['a']);
    expect(removeSectionAtBar(song, 3)).toBe(song);
  });
});
