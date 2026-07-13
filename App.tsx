import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { defaultAudioEngine } from './src/infrastructure/audio/defaultAudioEngine';
import { clickSoundService } from './src/application/services/clickSoundServiceInstance';
import RootNavigator from './src/presentation/navigation/RootNavigator';
import { store } from './src/store';

export default function App() {
  useEffect(() => {
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
