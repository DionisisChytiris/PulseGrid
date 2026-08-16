import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { defaultAudioEngine } from './src/infrastructure/audio/defaultAudioEngine';
import { clickSoundService } from './src/application/services/clickSoundServiceInstance';
import RootNavigator from './src/presentation/navigation/RootNavigator';
import { lockPortraitUpSafe } from './src/presentation/utils/safeScreenOrientation';
import { AnalyticsService } from './src/services/AnalyticsService';
import { store } from './src/store';

export default function App() {
  useEffect(() => {
    // console.log("App useEffect");
    // App-wide default: portrait. Song Editor may temporarily lock landscape.
    void lockPortraitUpSafe();
    defaultAudioEngine.initialize();
    void clickSoundService.hydrate();
    // console.log("Before Analytics");

  AnalyticsService.logAppStarted();

  // console.log("After Analytics");
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <RootNavigator />
        <StatusBar style="light" />
      </NavigationContainer>
    </Provider>
  );
}
