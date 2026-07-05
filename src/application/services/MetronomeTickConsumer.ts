import { setTick } from '../../features/metronome/metronomeSlice';
import type { TimingTick } from '../../domain/timing/TimingTick';
import type { AppDispatch, RootState } from '../../store';

/**
 * Consumes pure timing ticks and applies UI side effects (Redux / beat dots).
 * Click playback runs on the native timing thread — not here.
 */
export class MetronomeTickConsumer {
  constructor(
    private readonly dispatch: AppDispatch,
    private readonly getState: () => RootState,
  ) {}

  handleTick(timingTick: TimingTick): void {
    const { timeSignature } = this.getState().metronome;
    const beatIndex = (timingTick.beatNumber - 1) % timeSignature.numerator;

    this.dispatch(
      setTick({
        beatIndex,
        subdivisionIndex: timingTick.subdivisionIndex,
        isAccent: timingTick.isAccent,
        timestamp: timingTick.timestamp,
      }),
    );
  }
}
