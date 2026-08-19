import { createSection } from '../Section';
import type { Song } from '../Song';
import { sanitizeSongName } from '../songName';
import { generateEntityId } from '../storage/generateEntityId';

/** Preset section names for the compact bar editor. */
export const SECTION_NAME_PRESETS = [
  'Intro',
  'Verse',
  'Chorus',
  'Bridge',
  'Outro',
] as const;

export type SectionNamePreset = (typeof SECTION_NAME_PRESETS)[number];

function locateGlobalBar(
  song: Song,
  globalBarIndex: number,
): { sectionIndex: number; barIndex: number } | null {
  if (globalBarIndex < 0) {
    return null;
  }

  let remaining = globalBarIndex;

  for (let sectionIndex = 0; sectionIndex < song.sections.length; sectionIndex += 1) {
    const section = song.sections[sectionIndex];
    if (remaining < section.bars.length) {
      return { sectionIndex, barIndex: remaining };
    }
    remaining -= section.bars.length;
  }

  return null;
}

/**
 * Starts a named section at [globalBarIndex] using the existing Song.sections model.
 * If that bar is already the first bar of a section, the section is renamed.
 * Otherwise the owning section is split so the new section begins at that bar.
 */
export function createSectionAtBar(song: Song, globalBarIndex: number, name: string): Song {
  const sectionName = sanitizeSongName(name);
  const located = locateGlobalBar(song, globalBarIndex);
  if (located === null) {
    return song;
  }

  const section = song.sections[located.sectionIndex];
  if (section === undefined) {
    return song;
  }

  if (located.barIndex === 0) {
    if (section.name === sectionName) {
      return song;
    }

    const sections = [...song.sections];
    sections[located.sectionIndex] = { ...section, name: sectionName };
    return { ...song, updatedAt: Date.now(), sections };
  }

  const before = section.bars.slice(0, located.barIndex);
  const after = section.bars.slice(located.barIndex);
  if (after.length === 0) {
    return song;
  }

  const created = createSection({
    id: generateEntityId('section'),
    name: sectionName,
    bars: after,
    loop: section.loop,
  });

  const sections = [...song.sections];
  sections.splice(located.sectionIndex, 1, { ...section, bars: before }, created);

  return { ...song, updatedAt: Date.now(), sections };
}

/**
 * Removes the section that starts at [globalBarIndex] by merging its bars into
 * a neighbour section, or reverting a lone explicit section back to implicit Main.
 * No-op when the bar is not a section start.
 */
export function removeSectionAtBar(song: Song, globalBarIndex: number): Song {
  const located = locateGlobalBar(song, globalBarIndex);
  if (located === null) {
    return song;
  }

  const { sectionIndex, barIndex } = located;
  if (barIndex !== 0) {
    return song;
  }

  const section = song.sections[sectionIndex];
  if (section === undefined) {
    return song;
  }

  const sections = [...song.sections];

  if (sections.length === 1) {
    if (section.name === 'Main') {
      return song;
    }

    sections[0] = { ...section, name: 'Main' };
    return { ...song, updatedAt: Date.now(), sections };
  }

  if (sectionIndex === 0) {
    const next = sections[1]!;
    sections.splice(0, 2, {
      ...next,
      bars: [...section.bars, ...next.bars],
    });
    return { ...song, updatedAt: Date.now(), sections };
  }

  const previous = sections[sectionIndex - 1]!;
  sections.splice(sectionIndex - 1, 2, {
    ...previous,
    bars: [...previous.bars, ...section.bars],
  });
  return { ...song, updatedAt: Date.now(), sections };
}
