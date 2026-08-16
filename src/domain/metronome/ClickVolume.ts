export type ClickVolumeChannel = 'bar' | 'accent' | 'normal';

export type ClickVolumes = {
  bar: number;
  accent: number;
  normal: number;
};

export const DEFAULT_CLICK_VOLUMES: ClickVolumes = {
  bar: 70,
  accent: 65,
  normal: 60,
};

export type ClickVolumeChannelMeta = {
  key: ClickVolumeChannel;
  label: string;
};

export const CLICK_VOLUME_CHANNELS: readonly ClickVolumeChannelMeta[] = [
  { key: 'bar', label: 'Bar Beat' },
  { key: 'accent', label: 'Accent Beat' },
  { key: 'normal', label: 'Normal Beat (Click)' },
];

export function clampClickVolume(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Linear 0–100 UI percent → native player gain 0–1. */
export function clickVolumeToGain(percent: number): number {
  return clampClickVolume(percent) / 100;
}
