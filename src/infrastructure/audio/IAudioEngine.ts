export interface IAudioEngine {
  initialize(): void;
  /** Resolves when preload has finished and clicks are ready to play. */
  whenReady(): Promise<void>;
  /** Primes the audio pipeline (e.g. silent play) before metronome ticks begin. */
  warmUp(): Promise<void>;
  start(): void;
  stop(): void;
  playAccentClick(): void;
  playNormalClick(): void;
  setTempo(bpm: number): void;
}
