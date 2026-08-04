export const NORMAL_CLICK_SOUNDS = [
  { id: 'classic', label: 'Default' },
  { id: 'soft', label: 'Soft' },
  { id: 'digital', label: 'Digital' },
  { id: 'bright', label: 'Bright' },
  { id: 'cowbell', label: 'Cowbell' },
] as const;

export const ACCENT_CLICK_SOUNDS = [
  { id: 'classic_accent', label: 'Default Accent' },
  { id: 'strong_accent', label: 'Strong Accent' },
  { id: 'digital_accent', label: 'Digital Accent' },
  { id: 'cowbell_accent', label: 'Cowbell Accent' },
] as const;

/** Bar bank reuses accent sample IDs/files until dedicated bar assets exist. */
export const BAR_CLICK_SOUNDS = [
  { id: 'classic_accent', label: 'Default Bar' },
  { id: 'strong_accent', label: 'Strong Bar' },
  { id: 'digital_accent', label: 'Digital Bar' },
  { id: 'cowbell_accent', label: 'Cowbell Bar' },
] as const;

export const SUBDIVISION_CLICK_SOUNDS = [
  { id: 'classic', label: 'Default Subdivision' },
  { id: 'soft', label: 'Soft' },
  { id: 'digital', label: 'Digital' },
  { id: 'bright', label: 'Bright' },
  { id: 'cowbell', label: 'Cowbell' },
] as const;

export type NormalClickSoundId = (typeof NORMAL_CLICK_SOUNDS)[number]['id'];
export type AccentClickSoundId = (typeof ACCENT_CLICK_SOUNDS)[number]['id'];
export type BarClickSoundId = (typeof BAR_CLICK_SOUNDS)[number]['id'];
export type SubdivisionClickSoundId = (typeof SUBDIVISION_CLICK_SOUNDS)[number]['id'];

export type ClickSoundId =
  | NormalClickSoundId
  | AccentClickSoundId
  | BarClickSoundId
  | SubdivisionClickSoundId;

export const DEFAULT_NORMAL_CLICK_SOUND: NormalClickSoundId = 'classic';
export const DEFAULT_ACCENT_CLICK_SOUND: AccentClickSoundId = 'classic_accent';
/**
 * Temporary test default: a different existing accent sample than Accent
 * so BAR and ACCENT load distinct buffers/content by default.
 */
export const DEFAULT_BAR_CLICK_SOUND: BarClickSoundId = 'strong_accent';
export const DEFAULT_SUBDIVISION_CLICK_SOUND: SubdivisionClickSoundId = 'classic';

export type MetronomeSoundSettings = {
  readonly normalClickSound: NormalClickSoundId;
  readonly accentClickSound: AccentClickSoundId;
  readonly barClickSound: BarClickSoundId;
  readonly subdivisionClickSound: SubdivisionClickSoundId;
};

export const DEFAULT_METRONOME_SOUND_SETTINGS: MetronomeSoundSettings = {
  normalClickSound: DEFAULT_NORMAL_CLICK_SOUND,
  accentClickSound: DEFAULT_ACCENT_CLICK_SOUND,
  barClickSound: DEFAULT_BAR_CLICK_SOUND,
  subdivisionClickSound: DEFAULT_SUBDIVISION_CLICK_SOUND,
};

export function isNormalClickSoundId(value: string): value is NormalClickSoundId {
  return NORMAL_CLICK_SOUNDS.some((sound) => sound.id === value);
}

export function isAccentClickSoundId(value: string): value is AccentClickSoundId {
  return ACCENT_CLICK_SOUNDS.some((sound) => sound.id === value);
}

export function isBarClickSoundId(value: string): value is BarClickSoundId {
  return BAR_CLICK_SOUNDS.some((sound) => sound.id === value);
}

export function isSubdivisionClickSoundId(value: string): value is SubdivisionClickSoundId {
  return SUBDIVISION_CLICK_SOUNDS.some((sound) => sound.id === value);
}

export function normalizeNormalClickSound(value: string | undefined): NormalClickSoundId {
  return value && isNormalClickSoundId(value) ? value : DEFAULT_NORMAL_CLICK_SOUND;
}

export function normalizeAccentClickSound(value: string | undefined): AccentClickSoundId {
  return value && isAccentClickSoundId(value) ? value : DEFAULT_ACCENT_CLICK_SOUND;
}

/**
 * Prefer an explicit bar value; otherwise use the temporary distinct Bar default
 * (strong_accent) so BAR ≠ ACCENT for audible testing.
 */
export function normalizeBarClickSound(value: string | undefined): BarClickSoundId {
  return value && isBarClickSoundId(value) ? value : DEFAULT_BAR_CLICK_SOUND;
}

export function normalizeSubdivisionClickSound(
  value: string | undefined,
): SubdivisionClickSoundId {
  return value && isSubdivisionClickSoundId(value)
    ? value
    : DEFAULT_SUBDIVISION_CLICK_SOUND;
}
