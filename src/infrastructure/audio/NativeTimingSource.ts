import type { TimingTick } from '../../domain/timing/TimingTick';

import { audioDebugLog } from './audioDebugLog';
import type { ITimingSource, TimingTickListener } from './ITimingSource';
import type { MetronomeStartConfig } from './IAudioEngine';
import NativeAudioModule, { type NativeTickEvent } from './NativeAudioModuleClient';

/**
 * Forwards native onTick events as pure TimingTick signals.
 * Does not start or stop the native loop — that is NativeAudioEngine's job.
 */
export class NativeTimingSource implements ITimingSource {
  private tickListener: TimingTickListener = null;
  private tickUnsubscribe: (() => void) | null = null;
  private lastSequence = -1;

  initialize(): void {
    this.ensureTickSubscription();
  }

  setTickListener(listener: TimingTickListener): void {
    this.tickListener = listener;
  }

  private ensureTickSubscription(): void {
    if (this.tickUnsubscribe) {
      return;
    }

    const subscription = NativeAudioModule.addListener?.('onTick', (event: NativeTickEvent) => {
      this.handleNativeTick(event);
    });

    if (subscription) {
      this.tickUnsubscribe = () => subscription.remove();
      audioDebugLog('NativeTimingSource', 'addListener', 'single onTick handler registered');
    }
  }

  private handleNativeTick(event: NativeTickEvent): void {
    const sequence = event.sequence ?? -1;

    if (sequence >= 0 && sequence <= this.lastSequence) {
      audioDebugLog(
        'NativeTimingSource',
        'onTick',
        `duplicate blocked seq=${sequence} last=${this.lastSequence}`,
      );
      return;
    }

    this.lastSequence = sequence;

    const tick: TimingTick = {
      sequence,
      beatNumber: event.beatNumber,
      subdivisionIndex: event.subdivisionIndex,
      isAccent: event.isAccent,
      timestamp: event.timestamp,
    };

    audioDebugLog(
      'NativeTimingSource',
      'onTick',
      `seq=${tick.sequence} beat=${tick.beatNumber} ts=${tick.timestamp}`,
    );

    this.tickListener?.(tick);
  }

  /** Native loop lifecycle is owned by NativeAudioEngine. */
  startTiming(_config: MetronomeStartConfig): void {
    this.ensureTickSubscription();
    this.lastSequence = -1;
  }

  stopTiming(): void {
    this.lastSequence = -1;
  }

  setTimingTempo(_bpm: number): void {
    // Tempo updates go through NativeAudioEngine.setTempo on the native loop.
  }
}

export const nativeTimingSource = new NativeTimingSource();

nativeTimingSource.initialize();
