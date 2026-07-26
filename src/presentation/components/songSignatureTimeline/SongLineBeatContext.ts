import { createContext, useContext } from 'react';

/**
 * Beat index for Song Line LED lamps.
 * Delivered via context so FlatList does not need currentBeatIndex in extraData
 * (avoids remounting/reconciliation of the list on every pulse).
 */
export const SongLineBeatContext = createContext(-1);

export function useSongLineBeatIndex(): number {
  return useContext(SongLineBeatContext);
}
