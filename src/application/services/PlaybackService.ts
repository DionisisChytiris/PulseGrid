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
import type { AppDispatch, RootState } from '../../store';
import type { INativeAudioBridge } from '../../infrastructure/audio/INativeAudioBridge';
import { nativeAudioBridge } from '../../infrastructure/audio/NativeAudioBridge';

function formatTimeSignature({ numerator, denominator }: TimeSignature): string {
  return `${numerator}/${denominator}`;
}

export class PlaybackService {
  private readonly runtimeScheduler: RuntimeScheduler;
  private readonly tapTempoCalculator: TapTempoCalculator;

  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
    private readonly audioBridge: INativeAudioBridge = nativeAudioBridge,
  ) {
    const { bpm, timeSignature, accentPattern, subdivision } = this.getState().metronome;

    this.tapTempoCalculator = new TapTempoCalculator(DEFAULT_TAP_TEMPO_CONFIG);

    this.runtimeScheduler = new RuntimeScheduler({
      clock: new BeatClock(createTempoState(bpm)),
      timeSignature,
      accentPattern: AccentPattern.create(accentPattern, timeSignature.numerator),
      subdivision: Subdivision.fromKind(subdivision),
      onTick: (tick) => this.dispatch(setTick(tick)),
    });
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
    this.runtimeScheduler.start();
    this.audioBridge.start();
  }

  stop(): void {
    this.runtimeScheduler.stop();
    this.dispatch(playbackStopped());
    console.log('Playback stopped');
    this.audioBridge.stop();
  }

  setBpm(bpm: number): void {
    this.dispatch(bpmChanged(bpm));
    this.runtimeScheduler.setTempo(createTempoState(bpm));
    console.log(`Tempo changed to ${bpm} BPM`);
    this.audioBridge.setTempo(bpm);
  }

  setTimeSignature(timeSignature: TimeSignature): void {
    this.dispatch(timeSignatureChanged(timeSignature));
    this.runtimeScheduler.setTimeSignature(timeSignature);
    const { accentPattern } = this.getState().metronome;
    this.runtimeScheduler.setAccentPattern(
      AccentPattern.create(accentPattern, timeSignature.numerator),
    );
    console.log(`Time signature changed to ${formatTimeSignature(timeSignature)}`);
    this.audioBridge.setTimeSignature(timeSignature.numerator, timeSignature.denominator);
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
