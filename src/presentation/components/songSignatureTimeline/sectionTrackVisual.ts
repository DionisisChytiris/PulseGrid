/**
 * Subtle Signature Track section colours — grouping only, not a picker.
 * Cycle when a song has more sections than the palette.
 */
export const SECTION_TRACK_COLORS = [
  'rgba(59, 158, 255, 0.32)', // blue
  'rgba(52, 199, 89, 0.32)', // green
  'rgba(255, 159, 10, 0.32)', // orange
  'rgba(175, 82, 222, 0.32)', // purple
  'rgba(50, 173, 178, 0.32)', // teal
] as const;

/** Height of the bottom grouping strip — must stay inside MeterRegion paddingBottom (8). */
export const SECTION_TRACK_STRIP_HEIGHT = 3;

export function sectionTrackColor(sectionColorIndex: number): string {
  const palette = SECTION_TRACK_COLORS;
  const wrapped =
    ((sectionColorIndex % palette.length) + palette.length) % palette.length;
  return palette[wrapped]!;
}

/** Default name of the implicit section created with a new / legacy timeline. */
export const IMPLICIT_SECTION_NAME = 'Main';

/**
 * True once the song has a user-created/named section.
 * A lone implicit "Main" section must not change Timeline visuals.
 */
export function songHasExplicitSectionVisuals(
  sections: readonly { readonly name: string }[],
): boolean {
  if (sections.length > 1) {
    return true;
  }

  const only = sections[0];
  if (only === undefined) {
    return false;
  }

  return only.name.trim() !== IMPLICIT_SECTION_NAME;
}

export function shouldRenderSectionStrip(showSectionVisuals: boolean): boolean {
  return showSectionVisuals;
}

/**
 * Section name shown inside a bar cell. Only the first bar of a section,
 * never an empty/whitespace label, and never for an implicit Main-only song.
 */
export function sectionNameForBar(
  sectionName: string,
  isSectionStart: boolean,
  barIndex: number,
  showSectionVisuals = true,
): string | null {
  if (!showSectionVisuals || !isSectionStart || barIndex !== 0) {
    return null;
  }

  const trimmed = sectionName.trim();
  return trimmed.length === 0 ? null : trimmed;
}
