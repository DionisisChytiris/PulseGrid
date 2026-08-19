import { IMPLICIT_SECTION_NAME } from './sectionTrackVisual';

type SectionLike = {
  readonly name: string;
  readonly bars: readonly unknown[];
};

function isNavigatorVisibleSection(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed !== IMPLICIT_SECTION_NAME;
}

/**
 * Maps a Section Navigator row index to the 0-based global bar index of that
 * section's first bar. Uses the same filtering order as explicitSectionNavigatorNames.
 */
export function firstGlobalBarIndexForNavigatorSectionIndex(
  sections: readonly SectionLike[],
  navigatorSectionIndex: number,
): number | null {
  if (navigatorSectionIndex < 0) {
    return null;
  }

  let globalBarIndex = 0;
  let navigatorCount = 0;

  for (const section of sections) {
    if (isNavigatorVisibleSection(section.name)) {
      if (navigatorCount === navigatorSectionIndex) {
        return section.bars.length > 0 ? globalBarIndex : null;
      }
      navigatorCount += 1;
    }

    globalBarIndex += section.bars.length;
  }

  return null;
}
