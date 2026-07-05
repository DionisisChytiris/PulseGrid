import type { TimingTick } from '../../domain/timing/TimingTick';

import type { MetronomeStartConfig } from './IAudioEngine';

export type TimingTickListener = ((tick: TimingTick) => void) | null;

/** Emits pure timing ticks — never drives UI or audio directly. */
export interface ITimingSource {
  initialize?(): void;
  setTickListener(listener: TimingTickListener): void;
  startTiming(config: MetronomeStartConfig): void;
  stopTiming(): void;
  setTimingTempo(bpm: number): void;
}
