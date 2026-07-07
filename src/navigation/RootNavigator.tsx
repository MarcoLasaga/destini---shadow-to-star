import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import PlaceholderScreen from '../screen/PlaceholderScreen';
import ClothingDetailsScreen from '../screen/ClothingDetailsScreen';
import EditClothingScreen from '../screen/EditClothingScreen';
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
        <Stack.Screen name="PackTrip" options={{ title: 'Pack Trip' }}>
          {() => <PlaceholderScreen title="Pack Trip" />}
        </Stack.Screen>
        <Stack.Screen name="Analytics" options={{ title: 'Wardrobe Analytics' }}>
          {() => <PlaceholderScreen title="Wardrobe Analytics" />}
        </Stack.Screen>
        <Stack.Screen name="ClothingDetails" component={ClothingDetailsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="EditClothing" component={EditClothingScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}