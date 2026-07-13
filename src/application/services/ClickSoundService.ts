import {
  accentClickSoundChanged,
  normalClickSoundChanged,
  settingsHydrated,
  subdivisionClickSoundChanged,
} from '../../features/settings/settingsSlice';
import type {
  AccentClickSoundId,
  NormalClickSoundId,
  SubdivisionClickSoundId,
} from '../../domain/metronome/ClickSoundCatalog';
import {
  loadMetronomeSettings,
  saveMetronomeSettings,
} from '../../infrastructure/persistence/metronomeSettingsStorage';
import type { AppDispatch, RootState } from '../../store';

import type { IAudioEngine } from '../../infrastructure/audio/IAudioEngine';

export class ClickSoundService {
  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioEngine: IAudioEngine,
  ) {}

  async hydrate(): Promise<void> {
    const settings = await loadMetronomeSettings();
    this.dispatch(settingsHydrated(settings));
    await this.audioEngine.whenReady();
    this.applyToEngine(settings);
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

  async setSubdivisionClickSound(soundId: SubdivisionClickSoundId): Promise<void> {
    this.dispatch(subdivisionClickSoundChanged(soundId));
    this.audioEngine.setSubdivisionClickSound(soundId);
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
    subdivisionClickSound: SubdivisionClickSoundId;
  }): void {
    this.audioEngine.setNormalClickSound(settings.normalClickSound);
    this.audioEngine.setAccentClickSound(settings.accentClickSound);
    this.audioEngine.setSubdivisionClickSound(settings.subdivisionClickSound);
  }

  private async persistCurrent(): Promise<void> {
    const {
      normalClickSound,
      accentClickSound,
      subdivisionClickSound,
      subdivisionAccentMode,
      subdivisionAccentEveryNth,
      subdivisionAccentPattern,
    } = this.getState().settings;
    await saveMetronomeSettings({
      normalClickSound,
      accentClickSound,
      subdivisionClickSound,
      subdivisionAccentMode,
      subdivisionAccentEveryNth,
      subdivisionAccentPattern,
    });
  }
}
