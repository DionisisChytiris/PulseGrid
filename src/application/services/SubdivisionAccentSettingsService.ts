import {
  subdivisionAccentEveryNthChanged,
  subdivisionAccentModeChanged,
  subdivisionAccentPatternChanged,
} from '../../features/settings/settingsSlice';
import { isCustomSubdivisionAccentAvailable } from '../../domain/metronome/SubdivisionAccentCatalog';
import { SubdivisionAccentMode } from '../../domain/metronome/SubdivisionAccentMode';
import type { SubdivisionAccentMode as SubdivisionAccentModeId } from '../../domain/metronome/SubdivisionAccentMode';
import { normalizeSubdivisionAccentEveryNth } from '../../domain/metronome/SubdivisionAccentMode';
import {
  INITIAL_SUBDIVISION_ACCENT_CUSTOM_PATTERN,
  normalizeSubdivisionAccentPattern,
  type SubdivisionAccentPattern,
} from '../../domain/metronome/SubdivisionAccentPattern';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import { saveMetronomeSettings } from '../../infrastructure/persistence/metronomeSettingsStorage';
import type { IAudioEngine } from '../../infrastructure/audio/IAudioEngine';
import type { AppDispatch, RootState } from '../../store';

const ACTIVE_SUBDIVISION_ACCENT_MODES = new Set<SubdivisionAccentModeId>([
  SubdivisionAccentMode.OFF,
  SubdivisionAccentMode.GROUP_START,
  SubdivisionAccentMode.EVERY_NTH,
  SubdivisionAccentMode.CUSTOM,
]);

export class SubdivisionAccentSettingsService {
  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioEngine: IAudioEngine,
  ) {}

  async hydrate(): Promise<void> {
    const { subdivisionAccentMode, subdivisionAccentEveryNth, subdivisionAccentPattern } =
      this.getState().settings;
    this.audioEngine.setSubdivisionAccentMode(subdivisionAccentMode);
    this.audioEngine.setSubdivisionAccentEveryNth(subdivisionAccentEveryNth);
    this.audioEngine.setSubdivisionAccentPattern(subdivisionAccentPattern);
    await this.syncCustomModeForSubdivision(this.getState().metronome.subdivision);
  }

  /**
   * When leaving 16th-note grids, CUSTOM mode falls back to OFF.
   * The saved custom pattern is preserved untouched.
   */
  async syncCustomModeForSubdivision(subdivision: SubdivisionKind): Promise<void> {
    const { subdivisionAccentMode } = this.getState().settings;
    if (
      subdivisionAccentMode !== SubdivisionAccentMode.CUSTOM ||
      isCustomSubdivisionAccentAvailable(subdivision)
    ) {
      return;
    }

    this.dispatch(subdivisionAccentModeChanged(SubdivisionAccentMode.OFF));
    this.audioEngine.setSubdivisionAccentMode(SubdivisionAccentMode.OFF);
    await this.persistCurrent();
  }

  async setSubdivisionAccentMode(mode: SubdivisionAccentModeId): Promise<void> {
    if (!ACTIVE_SUBDIVISION_ACCENT_MODES.has(mode)) {
      return;
    }

    if (
      mode === SubdivisionAccentMode.CUSTOM &&
      !isCustomSubdivisionAccentAvailable(this.getState().metronome.subdivision)
    ) {
      return;
    }

    if (
      mode === SubdivisionAccentMode.CUSTOM &&
      this.getState().settings.subdivisionAccentPattern.length === 0
    ) {
      await this.setSubdivisionAccentPattern(INITIAL_SUBDIVISION_ACCENT_CUSTOM_PATTERN);
    }

    this.dispatch(subdivisionAccentModeChanged(mode));
    this.audioEngine.setSubdivisionAccentMode(mode);
    await this.persistCurrent();
  }

  async setSubdivisionAccentEveryNth(value: number): Promise<void> {
    const everyNth = normalizeSubdivisionAccentEveryNth(value);
    this.dispatch(subdivisionAccentEveryNthChanged(everyNth));
    this.audioEngine.setSubdivisionAccentEveryNth(everyNth);
    await this.persistCurrent();
  }

  async setSubdivisionAccentPattern(pattern: SubdivisionAccentPattern): Promise<void> {
    const normalized = normalizeSubdivisionAccentPattern(pattern);
    this.dispatch(subdivisionAccentPatternChanged(normalized));
    this.audioEngine.setSubdivisionAccentPattern(normalized);
    await this.persistCurrent();
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
