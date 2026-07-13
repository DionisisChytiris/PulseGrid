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
