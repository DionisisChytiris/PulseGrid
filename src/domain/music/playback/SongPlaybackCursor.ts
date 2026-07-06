import type { CompiledPlaybackSequence } from '../compiler/CompiledPlaybackSequence';
import type { PlaybackEvent } from '../compiler/PlaybackEvent';

export type SongPlaybackCursorOptions = {
  readonly debugLog?: boolean;
  readonly loopStartIndex?: number;
  readonly loopEndIndex?: number;
};

export interface SongPlaybackCursor {
  readonly currentIndex: number;
  readonly isPlaying: boolean;
  readonly currentBarIndex: number;
  readonly loopStartIndex: number | undefined;
  readonly loopEndIndex: number | undefined;
  readonly eventCount: number;

  play(): void;
  pause(): void;
  stop(): void;
  seekTo(index: number): void;
  nextEvent(): PlaybackEvent | null;
  peek(offset: number): PlaybackEvent | null;
  reset(): void;
  setLoopRange(startIndex: number, endIndex: number): void;
  clearLoop(): void;
}

function clampIndex(index: number, maxExclusive: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }

  const floored = Math.floor(index);
  if (floored < 0) {
    return 0;
  }

  if (floored > maxExclusive) {
    return maxExclusive;
  }

  return floored;
}

function resolveBarIndex(events: readonly PlaybackEvent[], index: number): number {
  if (events.length === 0) {
    return 0;
  }

  const clamped = clampIndex(index, events.length - 1);
  return events[clamped]?.globalBarIndex ?? 0;
}

function assertValidLoopRange(
  startIndex: number,
  endIndex: number,
  eventCount: number,
): void {
  if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) {
    throw new RangeError('Loop indices must be integers');
  }

  if (startIndex < 0 || endIndex < 0) {
    throw new RangeError('Loop indices must be non-negative');
  }

  if (startIndex >= eventCount || endIndex >= eventCount) {
    throw new RangeError('Loop indices must be within the compiled event range');
  }

  if (startIndex > endIndex) {
    throw new RangeError('loopStartIndex must be less than or equal to loopEndIndex');
  }
}

class SongPlaybackCursorImpl implements SongPlaybackCursor {
  private readonly events: readonly PlaybackEvent[];

  private readonly debugLog: boolean;

  private _currentIndex: number;

  private _isPlaying: boolean;

  private _currentBarIndex: number;

  private _loopStartIndex: number | undefined;

  private _loopEndIndex: number | undefined;

  constructor(compiled: CompiledPlaybackSequence, options: SongPlaybackCursorOptions = {}) {
    this.events = compiled.events;
    this.debugLog = options.debugLog ?? false;
    this._currentIndex = 0;
    this._isPlaying = false;
    this._currentBarIndex = resolveBarIndex(this.events, 0);
    this._loopStartIndex = options.loopStartIndex;
    this._loopEndIndex = options.loopEndIndex;

    if (this._loopStartIndex !== undefined || this._loopEndIndex !== undefined) {
      if (this._loopStartIndex === undefined || this._loopEndIndex === undefined) {
        throw new RangeError('Both loopStartIndex and loopEndIndex must be provided together');
      }

      assertValidLoopRange(this._loopStartIndex, this._loopEndIndex, this.events.length);
    }
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get currentBarIndex(): number {
    return this._currentBarIndex;
  }

  get loopStartIndex(): number | undefined {
    return this._loopStartIndex;
  }

  get loopEndIndex(): number | undefined {
    return this._loopEndIndex;
  }

  get eventCount(): number {
    return this.events.length;
  }

  play(): void {
    this._isPlaying = true;
  }

  pause(): void {
    this._isPlaying = false;
  }

  stop(): void {
    this._isPlaying = false;
    this._currentIndex = 0;
    this._currentBarIndex = resolveBarIndex(this.events, 0);
  }

  seekTo(index: number): void {
    this._currentIndex = clampIndex(index, this.events.length);
    this._currentBarIndex = resolveBarIndex(
      this.events,
      Math.min(this._currentIndex, Math.max(0, this.events.length - 1)),
    );
  }

  peek(offset: number): PlaybackEvent | null {
    const safeOffset = Number.isFinite(offset) ? Math.floor(offset) : 0;
    const targetIndex = this._currentIndex + safeOffset;

    if (targetIndex < 0 || targetIndex >= this.events.length) {
      return null;
    }

    return this.events[targetIndex] ?? null;
  }

  nextEvent(): PlaybackEvent | null {
    if (!this._isPlaying) {
      return null;
    }

    if (this._currentIndex >= this.events.length) {
      if (!this.hasActiveLoop()) {
        return null;
      }

      this._currentIndex = this._loopStartIndex!;
    }

    const event = this.events[this._currentIndex] ?? null;
    if (event === null) {
      return null;
    }

    this._currentBarIndex = event.globalBarIndex;
    this._currentIndex += 1;

    if (this.debugLog) {
      console.log(
        `[SongPlaybackCursor] nextEvent seq=${event.sequence} ` +
          `index=${this._currentIndex - 1} bar=${event.globalBarIndex} playing=${this._isPlaying}`,
      );
    }

    this.applyLoopWrapIfNeeded();
    return event;
  }

  reset(): void {
    this._currentIndex = 0;
    this._currentBarIndex = resolveBarIndex(this.events, 0);
  }

  setLoopRange(startIndex: number, endIndex: number): void {
    assertValidLoopRange(startIndex, endIndex, this.events.length);
    this._loopStartIndex = startIndex;
    this._loopEndIndex = endIndex;

    if (this._currentIndex < startIndex || this._currentIndex > endIndex + 1) {
      this.seekTo(startIndex);
    }
  }

  clearLoop(): void {
    this._loopStartIndex = undefined;
    this._loopEndIndex = undefined;
  }

  private hasActiveLoop(): boolean {
    return this._loopStartIndex !== undefined && this._loopEndIndex !== undefined;
  }

  private applyLoopWrapIfNeeded(): void {
    if (!this.hasActiveLoop()) {
      return;
    }

    const loopEnd = this._loopEndIndex!;

    if (this._currentIndex > loopEnd) {
      this._currentIndex = this._loopStartIndex!;
    }

    if (this._currentIndex >= this.events.length && this.hasActiveLoop()) {
      this._currentIndex = this._loopStartIndex!;
    }
  }
}

export function createSongPlaybackCursor(
  compiled: CompiledPlaybackSequence,
  options?: SongPlaybackCursorOptions,
): SongPlaybackCursor {
  return new SongPlaybackCursorImpl(compiled, options);
}
