import { NativeModule, requireNativeModule } from 'expo';

import type { NativeAudioStartOptions, NativeSubdivisionKind } from './NativeAudioModule.types';

export type { NativeAudioStartOptions, NativeSubdivisionKind };

export type NativeTickEvent = {
  /** Monotonic tick counter since metronome start. */
  sequence: number;
  /** Zero-based beat position within the current bar. */
  beatIndex: number;
  /** One-based beat number within the current bar. */
  beatNumber: number;
  beatsPerMeasure: number;
  subdivisionIndex: number;
  isAccent: boolean;
  /** Milliseconds since metronome start. */
  timestamp: number;
};

declare class NativeAudioModule extends NativeModule<{
  onTick: (event: NativeTickEvent) => void;
}> {
  initialize(): void;
  areSoundsReady(): boolean;
  start(options: NativeAudioStartOptions): void;
  stop(): void;
  setTempo(bpm: number): void;
  setAccentPattern(accentPattern: boolean[]): void;
  setSubdivision(subdivision: NativeSubdivisionKind): void;
  setNormalClickSound(soundId: string): void;
  setAccentClickSound(soundId: string): void;
  setSubdivisionClickSound(soundId: string): void;
  setSubdivisionAccentMode(mode: string): void;
  setSubdivisionAccentEveryNth(value: number): void;
  setSubdivisionAccentPattern(pattern: boolean[]): void;
  previewNormalClick(): void;
  previewAccentClick(): void;
  previewSubdivisionClick(): void;
}

export default requireNativeModule<NativeAudioModule>('NativeAudioModule');
