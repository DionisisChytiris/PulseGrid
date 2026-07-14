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

export const SUBDIVISION_CLICK_SOUNDS = [
  { id: 'classic', label: 'Default Subdivision' },
  { id: 'soft', label: 'Soft' },
  { id: 'digital', label: 'Digital' },
  { id: 'bright', label: 'Bright' },
  { id: 'cowbell', label: 'Cowbell' },
] as const;

export type NormalClickSoundId = (typeof NORMAL_CLICK_SOUNDS)[number]['id'];
export type AccentClickSoundId = (typeof ACCENT_CLICK_SOUNDS)[number]['id'];
export type SubdivisionClickSoundId = (typeof SUBDIVISION_CLICK_SOUNDS)[number]['id'];

export type ClickSoundId =
  | NormalClickSoundId
  | AccentClickSoundId
  | SubdivisionClickSoundId;

export const DEFAULT_NORMAL_CLICK_SOUND: NormalClickSoundId = 'classic';
export const DEFAULT_ACCENT_CLICK_SOUND: AccentClickSoundId = 'classic_accent';
export const DEFAULT_SUBDIVISION_CLICK_SOUND: SubdivisionClickSoundId = 'classic';

export type MetronomeSoundSettings = {
  readonly normalClickSound: NormalClickSoundId;
  readonly accentClickSound: AccentClickSoundId;
  readonly subdivisionClickSound: SubdivisionClickSoundId;
};

export const DEFAULT_METRONOME_SOUND_SETTINGS: MetronomeSoundSettings = {
  normalClickSound: DEFAULT_NORMAL_CLICK_SOUND,
  accentClickSound: DEFAULT_ACCENT_CLICK_SOUND,
  subdivisionClickSound: DEFAULT_SUBDIVISION_CLICK_SOUND,
};

export function isNormalClickSoundId(value: string): value is NormalClickSoundId {
  return NORMAL_CLICK_SOUNDS.some((sound) => sound.id === value);
}

export function isAccentClickSoundId(value: string): value is AccentClickSoundId {
  return ACCENT_CLICK_SOUNDS.some((sound) => sound.id === value);
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

export function normalizeSubdivisionClickSound(
  value: string | undefined,
): SubdivisionClickSoundId {
  return value && isSubdivisionClickSoundId(value)
    ? value
    : DEFAULT_SUBDIVISION_CLICK_SOUND;
}
