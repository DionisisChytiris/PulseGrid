import { MaterialCommunityIcons } from '@expo/vector-icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { studioColors } from '../theme';
import QuickMetronomeScreen from '../screens/QuickMetronomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SongsStackNavigator from './SongsStackNavigator';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: studioColors.accent,
        tabBarInactiveTintColor: studioColors.textMuted,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: studioColors.tabBarBackground,
          borderTopColor: studioColors.tabBarBorder,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={QuickMetronomeScreen}
        options={{
          headerShown: false,
          tabBarAccessibilityLabel: 'Metronome',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="metronome" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Songs"
        component={SongsStackNavigator}
        options={{
          headerShown: false,
          tabBarAccessibilityLabel: 'Timeline Builder',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'musical-notes' : 'musical-notes-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          tabBarAccessibilityLabel: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
