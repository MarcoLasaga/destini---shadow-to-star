import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { createBottomTabNavigator, BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import HomeScreen from '../screens/HomeScreen';
import WardrobeScreen from '../screens/WardrobeScreen';
import OutfitScreen from '../screens/OutfitScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CommunityScreen from '../screens/CommunityScreen';
import { MainTabParamList } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

const Tab = createBottomTabNavigator<MainTabParamList>();

type TabKey = keyof MainTabParamList;

const ICONS_ACTIVE: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Wardrobe: 'shirt',
  Outfit: 'sparkles',
  Community: 'people',
  Profile: 'person',
};

const ICONS_INACTIVE: Record<TabKey, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Wardrobe: 'shirt-outline',
  Outfit: 'sparkles-outline',
  Community: 'people-outline',
  Profile: 'person-outline',
};

const LABELS: Record<TabKey, string> = {
  Home: 'Home',
  Wardrobe: 'Wardrobe',
  Outfit: 'AI Stylist',
  Community: 'Community',
  Profile: 'Account',
};

export default function BottomTabNavigator() {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  const navSurface = isDark ? theme.surface : '#FFFFFF';
  const activeColor = isDark ? '#FBF5A7' : '#24152C';
  const inactiveColor = isDark ? '#DECFE8' : '#4B1D6F';
  const activePillBg = isDark ? '#4B1D6F' : '#DECFE8';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: route.name !== 'Outfit', // Center badge has label integrated or elevated
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor: navSurface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          overflow: 'visible',
          height: Platform.OS === 'ios' ? 88 : 74,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          elevation: 8,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 10,
        },
        tabBarItemStyle: {
          overflow: 'visible',
          height: 38,
          minWidth: 56,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarIconStyle: {
          overflow: 'visible',
          height: 38,
          minWidth: 56,
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: 2,
        },
        tabBarLabel: LABELS[route.name as TabKey],
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIconOuter}>
              <View style={[styles.tabIconWrapper, focused && { backgroundColor: activePillBg }]}>
                {focused && <View style={[styles.topIndicator, { backgroundColor: activeColor }]} />}
                <Ionicons
                  name={focused ? ICONS_ACTIVE.Home : ICONS_INACTIVE.Home}
                  size={20}
                  color={focused ? activeColor : inactiveColor}
                />
              </View>
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Wardrobe"
        component={WardrobeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIconOuter}>
              <View style={[styles.tabIconWrapper, focused && { backgroundColor: activePillBg }]}>
                {focused && <View style={[styles.topIndicator, { backgroundColor: activeColor }]} />}
                <Ionicons
                  name={focused ? ICONS_ACTIVE.Wardrobe : ICONS_INACTIVE.Wardrobe}
                  size={20}
                  color={focused ? activeColor : inactiveColor}
                />
              </View>
            </View>
          ),
        }}
      />

      {/* Center Elevated AI Outfit Tab */}
      <Tab.Screen
        name="Outfit"
        component={OutfitScreen}
        options={{
          tabBarButton: (props: BottomTabBarButtonProps) => {
            const isFocused = props.accessibilityState?.selected;
            return (
              <Pressable
                onPress={(e) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  props.onPress?.(e);
                }}
                style={styles.centerBadgeContainer}
              >
                <View
                  style={[
                    styles.centerBadge,
                    {
                      backgroundColor: '#FBF5A7',
                      borderColor: isDark ? '#FDD78B' : '#DECFE8',
                      shadowColor: '#24152C',
                    },
                  ]}
                >
                  <Ionicons
                    name={isFocused ? 'sparkles' : 'sparkles-outline'}
                    size={22}
                    color="#24152C"
                  />
                </View>
                <Text
                  style={[
                    styles.centerLabel,
                    {
                      color: isFocused ? activeColor : inactiveColor,
                    },
                  ]}
                >
                  Outfit
                </Text>
              </Pressable>
            );
          },
        }}
      />

      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIconOuter}>
              <View style={[styles.tabIconWrapper, focused && { backgroundColor: activePillBg }]}>
                {focused && <View style={[styles.topIndicator, { backgroundColor: activeColor }]} />}
                <Ionicons
                  name={focused ? ICONS_ACTIVE.Community : ICONS_INACTIVE.Community}
                  size={20}
                  color={focused ? activeColor : inactiveColor}
                />
              </View>
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabIconOuter}>
              <View style={[styles.tabIconWrapper, focused && { backgroundColor: activePillBg }]}>
                {focused && <View style={[styles.topIndicator, { backgroundColor: activeColor }]} />}
                <Ionicons
                  name={focused ? ICONS_ACTIVE.Profile : ICONS_INACTIVE.Profile}
                  size={20}
                  color={focused ? activeColor : inactiveColor}
                />
              </View>
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabIconOuter: {
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    height: 34,
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 30,
    borderRadius: 15,
    position: 'relative',
    overflow: 'visible',
  },
  topIndicator: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 2.5,
    borderRadius: 2,
  },
  centerBadgeContainer: {
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    overflow: 'visible',
  },
  centerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    letterSpacing: 0.2,
  },
});
