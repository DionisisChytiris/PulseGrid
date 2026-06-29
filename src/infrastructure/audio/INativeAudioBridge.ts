export interface INativeAudioBridge {
  initialize(): void;
  start(): void;
  stop(): void;
  setTempo(bpm: number): void;
  setTimeSignature(numerator: number, denominator: number): void;
  dispose(): void;
}
