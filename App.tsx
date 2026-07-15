import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { defaultAudioEngine } from './src/infrastructure/audio/defaultAudioEngine';
import { clickSoundService } from './src/application/services/clickSoundServiceInstance';
import RootNavigator from './src/presentation/navigation/RootNavigator';
import { lockPortraitUpSafe } from './src/presentation/utils/safeScreenOrientation';
import { store } from './src/store';

export default function App() {
  useEffect(() => {
    // App-wide default: portrait. Song Editor may temporarily lock landscape.
    void lockPortraitUpSafe();
    defaultAudioEngine.initialize();
    void clickSoundService.hydrate();
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
