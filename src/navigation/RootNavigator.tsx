import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { navigationRef } from './navigationRef';
import BottomTabNavigator from './BottomTabNavigator';
import NotificationsScreen from '../screens/NotificationsScreen';
import ClothingDetailsScreen from '../screens/ClothingDetailsScreen';
import EditClothingScreen from '../screens/EditClothingScreen';
import AddClothesScreen from '../screens/AddClothesScreen';
import BatchAddClothesScreen from '../screens/BatchAddClothesScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SavedOutfitsScreen from '../screens/SavedOutfitsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HelpScreen from '../screens/HelpScreen';
import OutfitDetailsScreen from '../screens/OutfitDetailsScreen';
import OutfitScreen from '../screens/OutfitScreen';
import PlanDayScreen from '../screens/PlanDayScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  headerBackTitle: 'Back',
  headerShadowVisible: false,
};

export default function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@stylesense_onboarding_complete').then((value) => {
      setOnboardingComplete(value === 'true');
    });
  }, []);

  if (loading || onboardingComplete === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#756E9E" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={screenOptions}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} options={{ headerShown: false }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AddClothes" component={AddClothesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="BatchAddClothes" component={BatchAddClothesScreen} options={{ headerShown: false }} />
            <Stack.Screen name="GenerateOutfit" options={{ headerShown: false }}>
              {() => <OutfitScreen />}
            </Stack.Screen>
            <Stack.Screen name="PlanDay" component={PlanDayScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ClothingDetails" component={ClothingDetailsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditClothing" component={EditClothingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="SavedOutfits" component={SavedOutfitsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Help" component={HelpScreen} options={{ headerShown: false }} />
            <Stack.Screen name="OutfitDetails" component={OutfitDetailsScreen} options={{ headerShown: false }} />
          </>
        ) : !onboardingComplete ? (
          <>
            <Stack.Screen name="Onboarding" options={{ headerShown: false }}>
              {() => (
                <OnboardingScreen
                  onComplete={() => setOnboardingComplete(true)}
                  onNavigateToLogin={() => setOnboardingComplete(true)}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
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
