import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
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
import { MelMascot } from '../components/MelMascot';
import { RootStackParamList } from '../types';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions: NativeStackNavigationOptions = {
  headerShown: false,
  headerBackTitle: 'Back',
  headerShadowVisible: false,
};

function AppOpeningScreen() {
  return (
    <View style={openingStyles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={openingStyles.centerCard}>
        <View style={openingStyles.emblemOuter}>
          <View style={openingStyles.emblemInner}>
            <MelMascot outfit="casual_sunny" waving size={74} />
          </View>
          <View style={openingStyles.accentBadge}>
            <Ionicons name="sparkles" size={13} color="#F3F1EF" />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(80).duration(380)} style={openingStyles.brandBlock}>
          <View style={openingStyles.pillTag}>
            <View style={openingStyles.pillDot} />
            <Text style={openingStyles.pillTagText}>PERSONAL AI STYLIST</Text>
          </View>
          <Text style={openingStyles.brandTitle}>StyleSense</Text>
          <Text style={openingStyles.brandSubtitle}>
            Smart wardrobe curation & daily outfit styling
          </Text>
        </Animated.View>

        <View style={openingStyles.loaderRow}>
          <ActivityIndicator size="small" color="#E83E35" />
          <Text style={openingStyles.loaderText}>Preparing your studio...</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('@stylesense_onboarding_complete').then((value) => {
      setOnboardingComplete(value === 'true');
    });
  }, []);

  if (loading || onboardingComplete === null) {
    return <AppOpeningScreen />;
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

const openingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#364536',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerCard: {
    alignItems: 'center',
    width: '100%',
  },
  emblemOuter: {
    position: 'relative',
    marginBottom: 24,
  },
  emblemInner: {
    width: 116,
    height: 116,
    borderRadius: 34,
    backgroundColor: 'rgba(243, 241, 239, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(243, 241, 239, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  accentBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E83E35',
    borderWidth: 2.5,
    borderColor: '#364536',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBlock: {
    alignItems: 'center',
  },
  pillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(243, 241, 239, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  pillTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#F3F1EF',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F3F1EF',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 14,
    color: 'rgba(243, 241, 239, 0.78)',
    textAlign: 'center',
    lineHeight: 20,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 36,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  loaderText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#F3F1EF',
    letterSpacing: 0.2,
  },
});
