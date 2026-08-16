import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  AnalyticsService,
  type AnalyticsScreenName,
} from '../../services/AnalyticsService';

/** Logs screen_viewed once per navigation focus (not per render). */
export function useAnalyticsScreenView(screen: AnalyticsScreenName): void {
  useFocusEffect(
    useCallback(() => {
      AnalyticsService.logScreenViewed(screen);
    }, [screen]),
  );
}
