import type { SubdivisionKind } from '../../domain/valueObjects/Subdivision';

/** Shared start configuration for native timing and audio engines. */
export type MetronomeStartConfig = {
  bpm: number;
  beatsPerMeasure: number;
  accentPattern: boolean[];
  subdivision: SubdivisionKind;
};

/** Native audio engine contract — lifecycle, tempo, accent pattern, and subdivision. */
export interface IAudioEngine {
  initialize(): void;
  whenReady(): Promise<void>;
  start(config: MetronomeStartConfig): void;
  stop(): void;
  setTempo(bpm: number): void;
  setAccentPattern(accentPattern: boolean[]): void;
  setSubdivision(subdivision: SubdivisionKind): void;
}
