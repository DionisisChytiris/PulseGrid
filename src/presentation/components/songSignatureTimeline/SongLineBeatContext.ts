import { useSyncExternalStore } from 'react';

/**
 * Song Line playback highlight store — external so FlatList segment geometry
 * (and the list host) stay identity-stable while bar/beat highlights update.
 *
 * Inactive / idle subscribers pass enabled=false and do not re-render.
 */

let beatIndex = -1;
let barIndex = -1;
const beatListeners = new Set<() => void>();
const barListeners = new Set<() => void>();

export function setSongLineBeatIndex(next: number): void {
  if (next === beatIndex) {
    return;
  }
  beatIndex = next;
  for (const listener of beatListeners) {
    listener();
  }
}

export function getSongLineBeatIndex(): number {
  return beatIndex;
}

export function setSongLineBarIndex(next: number): void {
  if (next === barIndex) {
    return;
  }
  barIndex = next;
  for (const listener of barListeners) {
    listener();
  }
}

export function getSongLineBarIndex(): number {
  return barIndex;
}

function subscribeBeat(listener: () => void): () => void {
  beatListeners.add(listener);
  return () => {
    beatListeners.delete(listener);
  };
}

function subscribeBar(listener: () => void): () => void {
  barListeners.add(listener);
  return () => {
    barListeners.delete(listener);
  };
}

const subscribeNoop = (): (() => void) => () => {};
const getInactiveSnapshot = (): number => -1;

/**
 * @param enabled When false, skips store subscription so idle regions
 * do not re-render on every beat.
 */
export function useSongLineBeatIndex(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribeBeat : subscribeNoop,
    enabled ? getSongLineBeatIndex : getInactiveSnapshot,
    enabled ? getSongLineBeatIndex : getInactiveSnapshot,
  );
}

/**
 * @param enabled When false, skips store subscription (stopped / idle list).
 * Regions use this to derive active/past chrome without rebuilding segment VMs.
 */
export function useSongLineBarIndex(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribeBar : subscribeNoop,
    enabled ? getSongLineBarIndex : getInactiveSnapshot,
    enabled ? getSongLineBarIndex : getInactiveSnapshot,
  );
}
