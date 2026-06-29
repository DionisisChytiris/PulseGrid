import {
  accentPatternChanged,
  bpmChanged,
  playbackStarted,
  playbackStopped,
  setTick,
  subdivisionChanged,
  timeSignatureChanged,
} from '../../features/metronome/metronomeSlice';
import type { TimeSignature } from '../../domain/entities/Metronome';
import { DEFAULT_TAP_TEMPO_CONFIG, TapTempoCalculator, type TapTempoResult } from '../../domain/services/TapTempoCalculator';
import { AccentPattern } from '../../domain/valueObjects/AccentPattern';
import { Subdivision, type SubdivisionKind } from '../../domain/valueObjects/Subdivision';
import { BeatClock } from '../../domain/timing/BeatClock';
import { RuntimeScheduler } from '../../domain/timing/RuntimeScheduler';
import { createTempoState } from '../../domain/timing/TempoMap';
import type { Tick } from '../../domain/timing/Tick';
import type { IAudioEngine } from '../../infrastructure/audio/IAudioEngine';
import type { AppDispatch, RootState } from '../../store';

function formatTimeSignature({ numerator, denominator }: TimeSignature): string {
  return `${numerator}/${denominator}`;
}

/** One-shot delay before ticks begin — compensates for Android audio warm-up latency. */
const PLAYBACK_START_DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Coordinates metronome playback.
 *
 * Tick flow:
 * RuntimeScheduler → Tick → PlaybackService → IAudioEngine → sound
 *
 * Scheduling lives in RuntimeScheduler only. This service reacts to ticks and
 * decides which click (if any) to play via IAudioEngine.
 */
export class PlaybackService {
  private readonly runtimeScheduler: RuntimeScheduler;
  private readonly tapTempoCalculator: TapTempoCalculator;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioEngine: IAudioEngine,
  ) {
    const { bpm, timeSignature, accentPattern, subdivision } = this.getState().metronome;

    this.tapTempoCalculator = new TapTempoCalculator(DEFAULT_TAP_TEMPO_CONFIG);

    this.runtimeScheduler = new RuntimeScheduler({
      clock: new BeatClock(createTempoState(bpm)),
      timeSignature,
      accentPattern: AccentPattern.create(accentPattern, timeSignature.numerator),
      subdivision: Subdivision.fromKind(subdivision),
      onTick: (tick) => this.handleTick(tick),
    });
  }

  private handleTick(tick: Tick): void {
    this.dispatch(setTick(tick));
    this.playClickForTick(tick);
  }

  private playClickForTick(tick: Tick): void {
    if (tick.isAccent) {
      this.audioEngine.playAccentClick();
      return;
    }

    this.audioEngine.playNormalClick();
  }

  private applyAccentPattern(accents: boolean[]): void {
    const { timeSignature } = this.getState().metronome;
    const accentPattern = AccentPattern.create(accents, timeSignature.numerator);

    this.dispatch(accentPatternChanged(accents));
    this.runtimeScheduler.setAccentPattern(accentPattern);
  }

  start(): void {
    const { bpm, timeSignature, accentPattern, subdivision } = this.getState().metronome;

    this.runtimeScheduler.setTempo(createTempoState(bpm));
    this.runtimeScheduler.setTimeSignature(timeSignature);
    this.runtimeScheduler.setAccentPattern(
      AccentPattern.create(accentPattern, timeSignature.numerator),
    );
    this.runtimeScheduler.setSubdivision(Subdivision.fromKind(subdivision));

    this.dispatch(playbackStarted());
    console.log('Playback started');

    void this.startPlayback();
  }

  private async warmUpAudio(): Promise<void> {
    this.audioEngine.initialize();
    await this.audioEngine.whenReady();
    await this.audioEngine.warmUp();
  }

  private async startPlayback(): Promise<void> {
    await this.warmUpAudio();
    this.audioEngine.start();
    await delay(PLAYBACK_START_DELAY_MS);
    this.runtimeScheduler.start();
  }

  stop(): void {
    this.runtimeScheduler.stop();
    this.dispatch(playbackStopped());
    console.log('Playback stopped');
    this.audioEngine.stop();
  }

  setBpm(bpm: number): void {
    this.dispatch(bpmChanged(bpm));
    this.runtimeScheduler.setTempo(createTempoState(bpm));
    console.log(`Tempo changed to ${bpm} BPM`);
    this.audioEngine.setTempo(bpm);
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this.dispatch(timeSignatureChanged(timeSignature));
    this.runtimeScheduler.setTimeSignature(timeSignature);
    const { accentPattern } = this.getState().metronome;
    this.runtimeScheduler.setAccentPattern(
      AccentPattern.create(accentPattern, timeSignature.numerator),
    );
    console.log(`Time signature changed to ${formatTimeSignature(timeSignature)}`);
  }

  setAccentPattern(accents: boolean[]): void {
    this.applyAccentPattern(accents);
  }

  setSubdivision(subdivision: SubdivisionKind): void {
    this.dispatch(subdivisionChanged(subdivision));
    this.runtimeScheduler.setSubdivision(Subdivision.fromKind(subdivision));
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
