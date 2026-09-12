import React from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWeather } from '../hooks/useWeather';
import GreetingHeader from '../components/GreetingHeader';
import WeatherCard from '../components/WeatherCard';
import QuickShortcuts from '../components/QuickShortcuts';
import WardrobeSummary from '../components/WardrobeSummary';
import SustainabilityTip from '../components/SustainabilityTip';
import WardrobeAnalyticsPreview from '../components/WardrobeAnalyticsPreview';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useProfile } from '../contexts/ProfileContext';

export default function HomeScreen() {
  const theme = useAppTheme();
  const { weather, loading, refresh } = useWeather();
  const { items } = useWardrobe();
  const { profile } = useProfile();
  const stats = { items: items.length, favorites: items.filter((item) => item.favorite).length, toWash: items.filter((item) => item.status !== 'clean').length };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.secondaryAccent} />
        }
      >
        <GreetingHeader name={profile.firstName || profile.displayName || 'there'} hasNotifications={false} />
        <WeatherCard weather={weather} />
        <QuickShortcuts />
        <WardrobeSummary stats={stats} />
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
