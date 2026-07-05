import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';

import { defaultAudioEngine } from './src/infrastructure/audio/defaultAudioEngine';
import { DebugTimingOverlay } from './src/presentation/components/debug/DebugTimingOverlay';
import RootNavigator from './src/presentation/navigation/RootNavigator';
import { store } from './src/store';

export default function App() {
  useEffect(() => {
    defaultAudioEngine.initialize();
  }, []);

  return (
    <Provider store={store}>
      <NavigationContainer>
        <RootNavigator />
        {__DEV__ ? <DebugTimingOverlay /> : null}
        <StatusBar style="auto" />
      </NavigationContainer>
    </Provider>
  );
}
