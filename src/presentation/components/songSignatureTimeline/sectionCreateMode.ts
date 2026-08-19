import { SECTION_NAME_PRESETS, type SectionNamePreset } from '../../../domain/music/editor';
import type { TimelineSegmentViewModel } from '../../viewModels/TimelineSegmentViewModel';

export type SectionCreateMode = 'none' | 'preset' | 'custom';

export function segmentHasEstablishedSection(
  segment: Pick<
    TimelineSegmentViewModel,
    'isSectionStart' | 'showSectionVisuals' | 'sectionName'
  >,
): boolean {
  return (
    segment.isSectionStart &&
    segment.showSectionVisuals &&
    segment.sectionName.trim().length > 0
  );
}

/**
 * Compact Create Section radio state derived from the segment's existing section.
 * No section start → None; preset name → Preset; otherwise Custom.
 */
export function initialSectionCreateMode(
  segment: Pick<
    TimelineSegmentViewModel,
    'isSectionStart' | 'showSectionVisuals' | 'sectionName'
  >,
): SectionCreateMode {
  if (!segmentHasEstablishedSection(segment)) {
    return 'none';
  }

  const name = segment.sectionName.trim();
  if (SECTION_NAME_PRESETS.includes(name as SectionNamePreset)) {
    return 'preset';
  }

  return 'custom';
}
