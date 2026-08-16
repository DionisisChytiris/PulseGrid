export type ClickVolumeChannel = 'bar' | 'accent' | 'normal';

export type ClickVolumes = {
  bar: number;
  accent: number;
  normal: number;
};

export const DEFAULT_CLICK_VOLUME = 100;

export const DEFAULT_CLICK_VOLUMES: ClickVolumes = {
  bar: DEFAULT_CLICK_VOLUME,
  accent: DEFAULT_CLICK_VOLUME,
  normal: DEFAULT_CLICK_VOLUME,
};

export type ClickVolumeChannelMeta = {
  key: ClickVolumeChannel;
  label: string;
  logLabel: string;
};

export const CLICK_VOLUME_CHANNELS: readonly ClickVolumeChannelMeta[] = [
  { key: 'bar', label: 'Bar Beat', logLabel: 'Bar beat volume' },
  { key: 'accent', label: 'Accent Beat', logLabel: 'Accent beat volume' },
  { key: 'normal', label: 'Normal Beat (Click)', logLabel: 'Normal beat volume' },
];

export function clampClickVolume(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
