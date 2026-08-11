import { useSyncExternalStore } from 'react';

/**
 * Beat index for Song Line LED lamps — external store so follow-scroll’s rAF
 * loop is not coupled to a Context Provider re-render of every MeterRegion.
 *
 * Inactive regions pass enabled=false and do not subscribe (no per-beat work).
 */

let beatIndex = -1;
const listeners = new Set<() => void>();

export function setSongLineBeatIndex(next: number): void {
  if (next === beatIndex) {
    return;
  }
  beatIndex = next;
  for (const listener of listeners) {
    listener();
  }
}

export function getSongLineBeatIndex(): number {
  return beatIndex;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const subscribeNoop = (): (() => void) => () => {};
const getInactiveSnapshot = (): number => -1;

/**
 * @param enabled When false, skips store subscription so inactive regions
 * do not re-render on every beat.
 */
export function useSongLineBeatIndex(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    enabled ? getSongLineBeatIndex : getInactiveSnapshot,
    enabled ? getSongLineBeatIndex : getInactiveSnapshot,
  );
}
