import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import ClothingDetailsScreen from '../screens/ClothingDetailsScreen';
import EditClothingScreen from '../screens/EditClothingScreen';
import AddClothesScreen from '../screens/AddClothesScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SavedOutfitsScreen from '../screens/SavedOutfitsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import CookbookScreen from '../screens/CookbookScreen';
import PackingScreen from '../screens/PackingScreen';
import PackingTripDetailScreen from '../screens/PackingTripDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import OutfitDetailsScreen from '../screens/OutfitDetailsScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
};

export default function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF7F2' }}>
        <ActivityIndicator size="large" color="#756E9E" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Notifications" options={{ title: 'Notifications' }}>
          {() => <PlaceholderScreen title="Notifications" />}
        </Stack.Screen>
        <Stack.Screen name="AddClothes" component={AddClothesScreen} options={{ headerShown: false }} />
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
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
