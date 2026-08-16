export const NORMAL_CLICK_SOUNDS = [
  { id: 'classic', label: 'Default' },
  { id: 'clave', label: 'Clave' },
  { id: 'bongo', label: 'Bongo' },
] as const;

export const ACCENT_CLICK_SOUNDS = [
  { id: 'classic_accent', label: 'Default Accent' },
  { id: 'clave_accent', label: 'Clave Accent' },
  { id: 'bongo_accent', label: 'Bongo Accent' },
] as const;

export const BAR_CLICK_SOUNDS = [
  { id: 'classic_bar', label: 'Default Bar' },
  { id: 'clave_bar', label: 'Clave Bar' },
  { id: 'bongo_bar', label: 'Bongo Bar' },
] as const;

export const SUBDIVISION_CLICK_SOUNDS = [
  { id: 'classic', label: 'Default Subdivision' },
  { id: 'clave', label: 'Clave' },
  { id: 'bongo', label: 'Bongo' },
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
export const DEFAULT_BAR_CLICK_SOUND: BarClickSoundId = 'classic_bar';
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
