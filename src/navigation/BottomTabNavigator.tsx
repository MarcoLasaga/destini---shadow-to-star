import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import WardrobeScreen from '../screens/WardrobeScreen';
import OutfitScreen from '../screens/OutfitScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import { MainTabParamList } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Wardrobe: 'shirt',
  Outfit: 'sparkles',
  Discover: 'compass',
  Planner: 'calendar',
  Profile: 'person',
};

const LABELS: Record<keyof MainTabParamList, string> = {
  Home: 'Home',
  Wardrobe: 'Wardrobe',
  Outfit: 'Outfit',
  Discover: 'Discover',
  Planner: 'Planner',
  Profile: 'Account',
};

export default function BottomTabNavigator() {
  const theme = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.secondaryAccent,
        tabBarInactiveTintColor: theme.mode === 'dark' ? '#7A7686' : '#9A94AE',
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarLabel: LABELS[route.name as keyof MainTabParamList],
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={ICONS[route.name as keyof MainTabParamList]}
            color={color}
            size={focused ? size + 1 : size}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wardrobe" component={WardrobeScreen} />
      <Tab.Screen name="Outfit" component={OutfitScreen} />
      <Tab.Screen name="Discover">{() => <PlaceholderScreen title="Discover" />}</Tab.Screen>
      <Tab.Screen name="Planner">{() => <PlaceholderScreen title="Planner" />}</Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}