import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import ClothingDetailsScreen from '../screens/ClothingDetailsScreen';
import EditClothingScreen from '../screens/EditClothingScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SavedOutfitsScreen from '../screens/SavedOutfitsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import CookbookScreen from '../screens/CookbookScreen';
import PackingScreen from '../screens/PackingScreen';
import PackingTripDetailScreen from '../screens/PackingTripDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import OutfitDetailsScreen from '../screens/OutfitDetailsScreen';
import { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
};

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="MainTabs" component={BottomTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Notifications" options={{ title: 'Notifications' }}>
          {() => <PlaceholderScreen title="Notifications" />}
        </Stack.Screen>
        <Stack.Screen name="AddClothes" options={{ title: 'Add Clothes' }}>
          {() => <PlaceholderScreen title="Add Clothes" />}
        </Stack.Screen>
        <Stack.Screen name="GenerateOutfit" options={{ title: 'Generate Outfit' }}>
          {() => <PlaceholderScreen title="Generate Outfit" />}
        </Stack.Screen>
        <Stack.Screen name="PlanDay" options={{ title: 'Plan Day' }}>
          {() => <PlaceholderScreen title="Plan Day" />}
        </Stack.Screen>
        <Stack.Screen name="ClothingDetails" component={ClothingDetailsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditClothing" component={EditClothingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="SavedOutfits" component={SavedOutfitsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Cookbook" component={CookbookScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Packing" component={PackingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PackingTripDetail" component={PackingTripDetailScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Help" component={HelpScreen} options={{ headerShown: false }} />
        <Stack.Screen name="OutfitDetails" component={OutfitDetailsScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}