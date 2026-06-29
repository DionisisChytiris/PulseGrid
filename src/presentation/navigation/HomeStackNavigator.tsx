import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import QuickMetronomeScreen from '../screens/QuickMetronomeScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} /> */}
      <Stack.Screen name="QuickMetronome" component={QuickMetronomeScreen} />
    </Stack.Navigator>
  );
}
