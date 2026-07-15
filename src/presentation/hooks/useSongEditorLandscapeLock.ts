import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  lockLandscapeSafe,
  lockPortraitUpSafe,
} from '../utils/safeScreenOrientation';

/**
 * Locks landscape while the host screen is focused.
 * Restores portrait-up on blur/unmount (app-wide default behavior).
 * Safe when ExpoScreenOrientation is not in the installed binary.
 */
export function useSongEditorLandscapeLock(): void {
  useFocusEffect(
    useCallback(() => {
      void lockLandscapeSafe();

      return () => {
        void lockPortraitUpSafe();
      };
    }, []),
  );
}
