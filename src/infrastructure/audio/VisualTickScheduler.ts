import { BeatClock } from '../../domain/timing/BeatClock';
import { RuntimeScheduler } from '../../domain/timing/RuntimeScheduler';
import { createTempoState } from '../../domain/timing/TempoMap';
import type { TimingTick } from '../../domain/timing/TimingTick';
import { AccentPattern } from '../../domain/valueObjects/AccentPattern';
import { Subdivision, type SubdivisionKind } from '../../domain/valueObjects/Subdivision';

import type { MetronomeStartConfig } from './IAudioEngine';
import type { ITimingSource, TimingTickListener } from './ITimingSource';

/**
 * JS timing fallback for environments without native onTick (e.g. web).
 * Emits pure TimingTick signals — never drives UI or audio directly.
 */
export class VisualTickScheduler implements ITimingSource {
  private tickListener: TimingTickListener = null;
  private scheduler: RuntimeScheduler | null = null;
  private subdivision: SubdivisionKind = 'quarter';
  private isRunning = false;
  private sequence = -1;
  private beatsPerMeasure = 4;

  setTickListener(listener: TimingTickListener): void {
    this.tickListener = listener;
  }

  setSubdivision(subdivision: SubdivisionKind): void {
    this.subdivision = subdivision;

    if (this.isRunning && this.scheduler) {
      this.scheduler.setSubdivision(Subdivision.fromKind(subdivision));
    }
  }

  startTiming(config: MetronomeStartConfig): void {
    this.stopTiming();
    this.isRunning = true;
    this.sequence = -1;
    this.beatsPerMeasure = config.beatsPerMeasure;

    this.scheduler = new RuntimeScheduler({
      clock: new BeatClock(createTempoState(config.bpm)),
      timeSignature: { numerator: config.beatsPerMeasure, denominator: 4 },
      accentPattern: AccentPattern.create(config.accentPattern, config.beatsPerMeasure),
      subdivision: Subdivision.fromKind(this.subdivision),
      onTick: (tick) => {
        this.sequence += 1;
        const beatNumber = (tick.beatIndex % this.beatsPerMeasure) + 1;

        this.tickListener?.({
          sequence: this.sequence,
          beatNumber,
          subdivisionIndex: tick.subdivisionIndex,
          isAccent: tick.isAccent,
          timestamp: tick.timestamp,
        });
      },
    });

    this.scheduler.start();
  }

  stopTiming(): void {
    this.isRunning = false;
    this.sequence = -1;
    this.scheduler?.stop();
    this.scheduler = null;
  }

  setTimingTempo(bpm: number): void {
    this.scheduler?.setTempo(createTempoState(bpm));
  }

  setAccentPattern(accents: boolean[]): void {
    if (!this.scheduler) {
      return;
    }

    this.scheduler.setAccentPattern(
      AccentPattern.create(accents, this.beatsPerMeasure),
    );
  }
}

export const visualTickScheduler = new VisualTickScheduler();
