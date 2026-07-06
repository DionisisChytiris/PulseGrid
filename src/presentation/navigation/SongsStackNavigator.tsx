import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SongEditorScreen from '../screens/songs/editor/SongEditorScreen';
import SongLibraryScreen from '../screens/songs/SongLibraryScreen';
import type { SongsStackParamList } from './types';

const Stack = createNativeStackNavigator<SongsStackParamList>();

export default function SongsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SongLibrary" component={SongLibraryScreen} />
      <Stack.Screen name="SongEditor" component={SongEditorScreen} />
    </Stack.Navigator>
  );
}
