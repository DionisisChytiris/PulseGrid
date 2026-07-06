import type { PlaybackEvent } from '../../../domain/music/compiler/PlaybackEvent';

import type { EventSource } from './EventSource';

export type QuickMetronomeEventSourceConfig = {
  readonly bpm: number;
  readonly beatsPerMeasure: number;
  readonly ticksPerBeat: number;
  readonly accentPattern: readonly boolean[];
};

function resolveAccent(
  beatIndexInBar: number,
  subdivisionIndex: number,
  accentPattern: readonly boolean[],
): boolean {
  if (subdivisionIndex !== 0) {
    return false;
  }

  return accentPattern[beatIndexInBar % accentPattern.length] ?? false;
}

/**
 * Generates quick-metronome ticks using the same sequence math as native QuickMetronomeEventSource.
 */
export class QuickMetronomeEventSource implements EventSource {
  private sequence = 0;

  private config: QuickMetronomeEventSourceConfig;

  constructor(config: QuickMetronomeEventSourceConfig) {
    this.config = config;
  }

  get eventCount(): number | null {
    return null;
  }

  updateConfig(config: QuickMetronomeEventSourceConfig): void {
    this.config = config;
  }

  reset(): void {
    this.sequence = 0;
  }

  peekEvent(offset = 0): PlaybackEvent | null {
    return this.eventAtSequence(this.sequence + offset);
  }

  nextEvent(): PlaybackEvent | null {
    const event = this.eventAtSequence(this.sequence);
    if (event) {
      this.sequence += 1;
    }
    return event;
  }

  private eventAtSequence(sequence: number): PlaybackEvent | null {
    const { beatsPerMeasure, ticksPerBeat } = this.config;
    const subdivisionIndex = sequence % ticksPerBeat;
    const beatIndexInBar = Math.floor(sequence / ticksPerBeat) % beatsPerMeasure;

    return {
      sequence,
      barId: 'quick',
      sectionId: 'quick',
      meter: { numerator: beatsPerMeasure, denominator: 4 },
      bpm: this.config.bpm,
      accent: resolveAccent(beatIndexInBar, subdivisionIndex, this.config.accentPattern),
      subdivisionIndex,
      globalTickIndex: sequence,
      source: 'song',
      repeatIndex: 0,
      beatIndexInBar,
      globalBarIndex: Math.floor(sequence / ticksPerBeat / beatsPerMeasure),
    };
  }
}
