import type { SubdivisionKind } from '../valueObjects/Subdivision';
import {
  SubdivisionAccentMode,
  type SubdivisionAccentMode as SubdivisionAccentModeId,
} from './SubdivisionAccentMode';

export type SubdivisionAccentModeOption = {
  readonly id: SubdivisionAccentModeId;
  readonly label: string;
  readonly comingSoon: boolean;
};

export const SUBDIVISION_ACCENT_MODE_OPTIONS: readonly SubdivisionAccentModeOption[] = [
  { id: SubdivisionAccentMode.OFF, label: 'Off', comingSoon: false },
  { id: SubdivisionAccentMode.GROUP_START, label: 'Group Start', comingSoon: false },
  { id: SubdivisionAccentMode.EVERY_NTH, label: 'Every Nth', comingSoon: false },
  { id: SubdivisionAccentMode.CUSTOM, label: 'Custom', comingSoon: false },
] as const;

/** CUSTOM 4-step patterns require a 16th-note engine grid (ticksPerBeat = 4). */
export const CUSTOM_SUBDIVISION_ACCENT_REQUIRED_KIND: SubdivisionKind = 'sixteenth';

export const CUSTOM_SUBDIVISION_ACCENT_UNAVAILABLE_MESSAGE =
  'Custom patterns are currently available only for 16th-note subdivisions.';

export function isCustomSubdivisionAccentAvailable(
  subdivision: SubdivisionKind,
): boolean {
  return subdivision === CUSTOM_SUBDIVISION_ACCENT_REQUIRED_KIND;
}
