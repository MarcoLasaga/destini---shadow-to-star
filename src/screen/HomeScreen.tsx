import React from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWeather } from '../hooks/useWeather';
import { mockUser, mockWardrobeStats } from '../constants/mockData';
import GreetingHeader from '../components/GreetingHeader';
import WeatherCard from '../components/WeatherCard';
import QuickShortcuts from '../components/QuickShortcuts';
import WardrobeSummary from '../components/WardrobeSummary';
import SustainabilityTip from '../components/SustainabilityTip';
import WardrobeAnalyticsPreview from '../components/WardrobeAnalyticsPreview';

export default function HomeScreen() {
  const theme = useAppTheme();
  const { weather, loading, refresh } = useWeather();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.secondaryAccent} />
        }
      >
        <GreetingHeader name={mockUser.name} hasNotifications />
        <WeatherCard weather={weather} />
        <QuickShortcuts />
        <WardrobeSummary stats={mockWardrobeStats} />
        <SustainabilityTip />
        <WardrobeAnalyticsPreview />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 24 },
});