import { useSyncExternalStore } from 'react';

import NativeAudioModule, {
  type NativeDebugTimingEvent,
} from './NativeAudioModuleClient';

/** TEMP: remove with DebugTimingOverlay and native onDebugTiming event. */
export type DebugTimingState = {
  bpm: number;
  subdivision: string;
  tickCount: number;
  avgLatenessUs: number;
  maxLatenessUs: number;
  playbackFailures: number;
};

const initialState: DebugTimingState = {
  bpm: 0,
  subdivision: 'quarter',
  tickCount: 0,
  avgLatenessUs: 0,
  maxLatenessUs: 0,
  playbackFailures: 0,
};

let state = initialState;
const listeners = new Set<() => void>();
let subscription: { remove: () => void } | null = null;

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function mapEvent(event: NativeDebugTimingEvent): DebugTimingState {
  return {
    bpm: event.bpm,
    subdivision: event.subdivision,
    tickCount: event.sequence + 1,
    avgLatenessUs: event.avgLatenessUs,
    maxLatenessUs: event.maxLatenessUs,
    playbackFailures: event.playbackFailures,
  };
}

export function initializeDebugTimingBridge(): void {
  if (!__DEV__ || subscription) {
    return;
  }

  subscription = NativeAudioModule.addListener?.('onDebugTiming', (event: NativeDebugTimingEvent) => {
    state = mapEvent(event);
    emit();
  }) ?? null;
}

export function resetDebugTimingBridge(): void {
  state = initialState;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): DebugTimingState {
  return state;
}

export function useDebugTiming(): DebugTimingState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
