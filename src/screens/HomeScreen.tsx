import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWeather } from '../hooks/useWeather';
import GreetingHeader from '../components/GreetingHeader';
import WeatherCard from '../components/WeatherCard';
import WardrobeSummary from '../components/WardrobeSummary';
import { MelMascot, MelSpeechBubble, MelOutfit } from '../components/MelMascot';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useProfile } from '../contexts/ProfileContext';

function outfitForWeather(condition: string, temp: number): MelOutfit {
  const value = condition.toLowerCase();
  if (value.includes('rain') || value.includes('drizzle') || value.includes('storm') || value.includes('thunder')) return 'rain_active';
  if (value.includes('clear') && temp >= 28) return 'casual_sunny';
  if (temp < 23) return 'cool_hoodie';
  if (value.includes('cloud') || value.includes('overcast') || temp < 28) return 'smart_layered';
  return 'casual_sunny';
}

export default function HomeScreen() {
  const theme = useAppTheme(); const { weather, loading, refresh } = useWeather(); const { items } = useWardrobe(); const { profile } = useProfile(); const [tipIndex, setTipIndex] = useState(0);
  const temp = weather.tempC ?? Math.round((weather.tempF - 32) * 5 / 9); const melOutfit = outfitForWeather(weather.condition, temp);
  const tips = useMemo(() => [weather.tip, 'Air out knits between wears to keep them fresh and extend their life.', 'Save your favorite looks so Mel can help you remix them later.'], [weather.tip]);
  const message = tips[tipIndex % tips.length];
  const stats = { items: items.length, favorites: items.filter((item) => item.favorite).length, toWash: 0, categories: new Set(items.map((item) => item.category)).size, savedLooks: items.filter((item) => item.favorite).length };
  return <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.accent} />}>
    <GreetingHeader name={profile.firstName || profile.displayName || 'there'} hasNotifications={false} /><WeatherCard weather={weather} /><WardrobeSummary stats={stats} />
    <View style={styles.melArea}><MelSpeechBubble variant={melOutfit} message={message} position="bottom-right" onTapNextTip={() => setTipIndex((current) => current + 1)} /><MelMascot outfit={melOutfit} size={142} waving={melOutfit === 'rain_active'} onPress={() => setTipIndex((current) => current + 1)} /></View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { paddingBottom: 22 }, melArea: { minHeight: 168, marginTop: 4, marginRight: 14, alignItems: 'flex-end', justifyContent: 'flex-end', position: 'relative' } });
