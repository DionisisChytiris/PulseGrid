import {
  accentPatternChanged,
  bpmChanged,
  playbackStarted,
  playbackStopped,
  subdivisionChanged,
  timeSignatureChanged,
} from '../../features/metronome/metronomeSlice';
import { quickMetronomeModeActive } from '../../features/songPlayback/songPlaybackSlice';
import type { TimeSignature } from '../../domain/entities/Metronome';
import { DEFAULT_TAP_TEMPO_CONFIG, TapTempoCalculator, type TapTempoResult } from '../../domain/services/TapTempoCalculator';
import { AccentPattern } from '../../domain/valueObjects/AccentPattern';
import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import type { IAudioEngine, MetronomeStartConfig } from '../../infrastructure/audio/IAudioEngine';
import type { ITimingSource } from '../../infrastructure/audio/ITimingSource';
import { VisualTickScheduler } from '../../infrastructure/audio/VisualTickScheduler';
import { saveMetronomeSettings } from '../../infrastructure/persistence/metronomeSettingsStorage';
import type { AppDispatch, RootState } from '../../store';

import { buildPersistedMetronomeSettingsFromState } from './buildPersistedMetronomeSettingsFromState';
import { clickSoundService } from './clickSoundServiceInstance';
import type { MetronomeTickConsumer } from './MetronomeTickConsumer';
import type { TempoTrainerService } from './TempoTrainerService';

function formatTimeSignature({ numerator, denominator }: TimeSignature): string {
  return `${numerator}/${denominator}`;
}

/**
 * Coordinates metronome playback.
 *
 * UI → Redux → PlaybackService
 *              ├─ NativeAudioEngine (native timing loop + click playback)
 *              ├─ ITimingSource → TimingTick (UI sync only)
 *              └─ MetronomeTickConsumer → Redux UI
 *
 * Native engine is the sole timing and audio authority on device.
 */
export class PlaybackService {
  private readonly tapTempoCalculator: TapTempoCalculator;
  private playbackGeneration = 0;
  private tempoTrainer: TempoTrainerService | null = null;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioEngine: IAudioEngine,
    private readonly timingSource: ITimingSource,
    private readonly tickConsumer: MetronomeTickConsumer,
  ) {
    this.tapTempoCalculator = new TapTempoCalculator(DEFAULT_TAP_TEMPO_CONFIG);
    this.timingSource.setTickListener((tick) => {
      this.tickConsumer.handleTick(tick);
      this.tempoTrainer?.onTick(tick);
    });
  }

  /**
   * Attach Quick Metronome Practice Trainer. Optional so Song Timeline never constructs it.
   * BPM increases always call back into this.setBpm.
   */
  attachTempoTrainer(trainer: TempoTrainerService): void {
    this.tempoTrainer = trainer;
  }

  private getStartConfig(): MetronomeStartConfig {
    const { bpm, timeSignature, accentPattern, subdivision } = this.getState().metronome;

    return {
      bpm,
      beatsPerMeasure: timeSignature.numerator,
      accentPattern: [...accentPattern],
      subdivision,
    };
  }

  private applyAccentPattern(accents: boolean[]): void {
    const { timeSignature } = this.getState().metronome;
    AccentPattern.create(accents, timeSignature.numerator);

    this.dispatch(accentPatternChanged(accents));
    this.audioEngine.setAccentPattern(accents);

    if (this.timingSource instanceof VisualTickScheduler && this.getState().metronome.isPlaying) {
      this.timingSource.setAccentPattern(accents);
    }
  }

  private restartPlayback(): void {
    this.audioEngine.stop();
    this.timingSource.stopTiming();
    void this.startPlayback();
  }

  start(): void {
    if (this.getState().metronome.isPlaying) {
      console.log('PlaybackService.start() ignored — already playing');
      return;
    }

    this.dispatch(playbackStarted());
    this.dispatch(quickMetronomeModeActive());
    this.tempoTrainer?.onPlaybackStarted();
    console.log('Playback started');
    void this.startPlayback();
  }

  private async startPlayback(): Promise<void> {
    const generation = ++this.playbackGeneration;
    const config = this.getStartConfig();

    this.audioEngine.stop();
    this.timingSource.stopTiming();

    await this.audioEngine.whenReady();

    if (generation !== this.playbackGeneration) {
      console.log('PlaybackService.startPlayback() cancelled — superseded');
      return;
    }

    if (!this.getState().metronome.isPlaying) {
      console.log('PlaybackService.startPlayback() cancelled — no longer playing');
      return;
    }

    this.timingSource.startTiming(config);
    // Ensure Song Timeline's temporary Bar Start override is cleared for QM.
    clickSoundService.restoreBarStartEnabledToEngine();
    this.audioEngine.start(config);
  }

  stop(): void {
    this.playbackGeneration++;
    this.audioEngine.stop();
    this.timingSource.stopTiming();
    this.dispatch(playbackStopped());
    this.tempoTrainer?.onPlaybackStopped();
    console.log('Playback stopped');
  }

  setBpm(bpm: number): void {
    this.dispatch(bpmChanged(bpm));
    this.audioEngine.setTempo(bpm);
    this.timingSource.setTimingTempo(bpm);
    void this.persistQuickMetronomePreferences();
    console.log(`Tempo changed to ${bpm} BPM`);
  }

  private async persistQuickMetronomePreferences(): Promise<void> {
    await saveMetronomeSettings(buildPersistedMetronomeSettingsFromState(this.getState()));
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this.dispatch(timeSignatureChanged(timeSignature));
    void this.persistQuickMetronomePreferences();

    if (this.getState().metronome.isPlaying) {
      this.restartPlayback();
    }

    console.log(`Time signature changed to ${formatTimeSignature(timeSignature)}`);
  }

  setAccentPattern(accents: boolean[]): void {
    this.applyAccentPattern(accents);
    void this.persistQuickMetronomePreferences();
  }

  setSubdivision(subdivision: SubdivisionKind): void {
    this.dispatch(subdivisionChanged(subdivision));
    this.audioEngine.setSubdivision(subdivision);

    if (this.timingSource instanceof VisualTickScheduler) {
      this.timingSource.setSubdivision(subdivision);
    }

    // finerSubdivision is dispatched by the UI before this call; persist together.
    void this.persistQuickMetronomePreferences();
    console.log(`Subdivision changed to ${subdivision}`);
  }

  tapTempo(): TapTempoResult {
    const { bpm } = this.getState().metronome;
    const result = this.tapTempoCalculator.tap(Date.now());

    if (result.bpm === null) {
      console.log(`Tap tempo: ${result.tapCount} tap(s), waiting for more`);
      return result;
    }

    if (result.bpm !== bpm) {
      this.setBpm(result.bpm);
    }

    console.log(`Tap tempo: ${result.bpm} BPM from ${result.tapCount} taps`);
    return result;
  }
}
