import {
  accentClickSoundChanged,
  barClickSoundChanged,
  barStartEnabledChanged,
  normalClickSoundChanged,
  settingsHydrated,
  clickVolumeChanged,
} from '../../features/settings/settingsSlice';
import type {
  AccentClickSoundId,
  BarClickSoundId,
  NormalClickSoundId,
  SubdivisionClickSoundId,
} from '../../domain/metronome/ClickSoundCatalog';
import { clampBpmForSubdivision } from '../../domain/metronome/bpmLimits';
import {
  clampClickVolume,
  clickVolumeToGain,
  type ClickVolumeChannel,
} from '../../domain/metronome/ClickVolume';
import { toDisplayBpm, toEngineBpm } from '../../domain/metronome/PulseGridSettings';
import { bpmChanged, quickMetronomePreferencesHydrated } from '../../features/metronome/metronomeSlice';
import type { IAudioEngine } from '../../infrastructure/audio/IAudioEngine';
import {
  loadMetronomeSettings,
  saveMetronomeSettings,
} from '../../infrastructure/persistence/metronomeSettingsStorage';
import type { AppDispatch, RootState } from '../../store';

import { buildPersistedMetronomeSettingsFromState } from './buildPersistedMetronomeSettingsFromState';

export class ClickSoundService {
  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioEngine: IAudioEngine,
  ) {}

  async hydrate(): Promise<void> {
    const settings = await loadMetronomeSettings();
    this.dispatch(settingsHydrated(settings));
    this.dispatch(bpmChanged(settings.bpm));
    this.dispatch(
      quickMetronomePreferencesHydrated({
        timeSignature: settings.timeSignature,
        finerSubdivision: settings.finerSubdivision,
        accentPattern: settings.accentPattern,
      }),
    );
    // Clamp after subdivision is known from hydrated prefs (display-BPM caps).
    const { bpm, subdivision, timeSignature } = this.getState().metronome;
    const displayBpm = Math.round(toDisplayBpm(bpm, timeSignature.denominator));
    const clampedDisplay = clampBpmForSubdivision(displayBpm, subdivision);
    const clampedBpm = Math.round(toEngineBpm(clampedDisplay, timeSignature.denominator));
    if (clampedBpm !== bpm) {
      this.dispatch(bpmChanged(clampedBpm));
    }
    await this.audioEngine.whenReady();
    this.applyToEngine(settings);
    this.applyClickVolumes(settings);
    this.audioEngine.setBarStartEnabled(settings.barStartEnabled);
    this.audioEngine.setSubdivisionAccentMode(settings.subdivisionAccentMode);
    this.audioEngine.setSubdivisionAccentEveryNth(settings.subdivisionAccentEveryNth);
    this.audioEngine.setSubdivisionAccentPattern(settings.subdivisionAccentPattern);
  }

  async setNormalClickSound(soundId: NormalClickSoundId): Promise<void> {
    this.dispatch(normalClickSoundChanged(soundId));
    this.audioEngine.setNormalClickSound(soundId);
    await this.persistCurrent();
  }

  async setAccentClickSound(soundId: AccentClickSoundId): Promise<void> {
    this.dispatch(accentClickSoundChanged(soundId));
    this.audioEngine.setAccentClickSound(soundId);
    await this.persistCurrent();
  }

  async setBarClickSound(soundId: BarClickSoundId): Promise<void> {
    this.dispatch(barClickSoundChanged(soundId));
    this.audioEngine.setBarClickSound(soundId);
    await this.persistCurrent();
  }

  async setBarStartEnabled(enabled: boolean): Promise<void> {
    this.dispatch(barStartEnabledChanged(enabled));
    this.audioEngine.setBarStartEnabled(enabled);
    await this.persistCurrent();
  }

  /**
   * Push Bar Start to the native engine only.
   * Does not update Redux or persistence (Song Timeline temporary override).
   */
  syncBarStartEnabledToEngine(enabled: boolean): void {
    this.audioEngine.setBarStartEnabled(enabled);
  }

  /** Re-apply the saved Quick Metronome Bar Start preference to native. */
  restoreBarStartEnabledToEngine(): void {
    this.audioEngine.setBarStartEnabled(this.getState().settings.barStartEnabled);
  }

  async setSubdivisionClickSound(soundId: SubdivisionClickSoundId): Promise<void> {
    this.dispatch(subdivisionClickSoundChanged(soundId));
    this.audioEngine.setSubdivisionClickSound(soundId);
    await this.persistCurrent();
  }

  async setClickVolume(channel: ClickVolumeChannel, value: number): Promise<void> {
    const next = clampClickVolume(value);
    const current = this.getState().settings;
    const previous =
      channel === 'bar'
        ? current.barBeatVolume
        : channel === 'accent'
          ? current.accentBeatVolume
          : current.normalBeatVolume;
    if (previous === next) {
      return;
    }

    this.dispatch(clickVolumeChanged({ channel, value: next }));
    this.applyClickVolumeToEngine(channel, next);
    await this.persistCurrent();
  }

  previewNormalClick(soundId?: NormalClickSoundId): void {
    const current = this.getState().settings.normalClickSound;
    const previewId = soundId ?? current;
    if (previewId !== current) {
      this.audioEngine.setNormalClickSound(previewId);
    }
    this.audioEngine.previewNormalClick();
    if (previewId !== current) {
      this.audioEngine.setNormalClickSound(current);
    }
  }

  previewAccentClick(soundId?: AccentClickSoundId): void {
    const current = this.getState().settings.accentClickSound;
    const previewId = soundId ?? current;
    if (previewId !== current) {
      this.audioEngine.setAccentClickSound(previewId);
    }
    this.audioEngine.previewAccentClick();
    if (previewId !== current) {
      this.audioEngine.setAccentClickSound(current);
    }
  }

  previewBarClick(soundId?: BarClickSoundId): void {
    const current = this.getState().settings.barClickSound;
    const previewId = soundId ?? current;
    if (previewId !== current) {
      this.audioEngine.setBarClickSound(previewId);
    }
    this.audioEngine.previewBarClick();
    if (previewId !== current) {
      this.audioEngine.setBarClickSound(current);
    }
  }

  previewSubdivisionClick(soundId?: SubdivisionClickSoundId): void {
    const current = this.getState().settings.subdivisionClickSound;
    const previewId = soundId ?? current;
    if (previewId !== current) {
      this.audioEngine.setSubdivisionClickSound(previewId);
    }
    this.audioEngine.previewSubdivisionClick();
    if (previewId !== current) {
      this.audioEngine.setSubdivisionClickSound(current);
    }
  }

  private applyToEngine(settings: {
    normalClickSound: NormalClickSoundId;
    accentClickSound: AccentClickSoundId;
    barClickSound: BarClickSoundId;
    subdivisionClickSound: SubdivisionClickSoundId;
  }): void {
    this.audioEngine.setNormalClickSound(settings.normalClickSound);
    this.audioEngine.setAccentClickSound(settings.accentClickSound);
    this.audioEngine.setBarClickSound(settings.barClickSound);
    this.audioEngine.setSubdivisionClickSound(settings.subdivisionClickSound);
  }

  private applyClickVolumes(settings: {
    barBeatVolume: number;
    accentBeatVolume: number;
    normalBeatVolume: number;
  }): void {
    this.audioEngine.setBarClickVolume(clickVolumeToGain(settings.barBeatVolume));
    this.audioEngine.setAccentClickVolume(clickVolumeToGain(settings.accentBeatVolume));
    this.audioEngine.setNormalClickVolume(clickVolumeToGain(settings.normalBeatVolume));
  }

  private applyClickVolumeToEngine(channel: ClickVolumeChannel, value: number): void {
    const gain = clickVolumeToGain(value);
    switch (channel) {
      case 'bar':
        this.audioEngine.setBarClickVolume(gain);
        break;
      case 'accent':
        this.audioEngine.setAccentClickVolume(gain);
        break;
      case 'normal':
        this.audioEngine.setNormalClickVolume(gain);
        break;
    }
  }

  private async persistCurrent(): Promise<void> {
    await saveMetronomeSettings(buildPersistedMetronomeSettingsFromState(this.getState()));
  }
}
