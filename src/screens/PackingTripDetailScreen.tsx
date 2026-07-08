import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import { fetchWeatherByCoords, placeholderWeather } from '../services/weatherService';
import { WeatherData, RootStackParamList, PackingItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';

export default function PackingTripDetailScreen() {
  const theme = useAppTheme();
  const route = useRoute<RouteProp<RootStackParamList, 'PackingTripDetail'>>();
  const { getTrip, toggleItem } = usePacking();
  const [weather, setWeather] = useState<WeatherData>(placeholderWeather);

  const trip = getTrip(route.params.tripId);

  useEffect(() => {
    if (!trip) return;
    fetchWeatherByCoords(trip.lat, trip.lon, trip.destination)
      .then(setWeather)
      .catch(() => setWeather(placeholderWeather));
  }, [trip?.id]);

  if (!trip) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Trip" />
      </View>
    );
  }

  const packedCount = trip.checklist.filter((i) => i.checked).length;

  const categories: PackingItem['category'][] = ['Clothing', 'Footwear', 'Accessories', 'Toiletries', 'Essentials'];
  const sections = categories
    .map((category) => ({ title: category, data: trip.checklist.filter((i) => i.category === category) }))
    .filter((section) => section.data.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Packing" />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            <View style={[styles.tripCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.tripHeaderRow}>
                <Ionicons name="location" size={15} color={theme.secondaryAccent} />
                <Text style={[styles.tripDestination, { color: theme.text }]}>{trip.destination}</Text>
              </View>
              <Text style={[styles.tripDates, { color: theme.textMuted }]}>
                {new Date(trip.startDate).toDateString()} — {new Date(trip.endDate).toDateString()}
              </Text>
              <Text style={[styles.tripProgress, { color: theme.textMuted }]}>
                {packedCount} / {trip.checklist.length} packed
              </Text>
            </View>

            <View style={[styles.weatherCard, { backgroundColor: theme.mode === 'dark' ? '#1E2A33' : '#DCEEF7' }]}>
              <View style={styles.weatherHeader}>
                <Ionicons name="partly-sunny-outline" size={16} color={theme.text} />
                <Text style={[styles.weatherTitle, { color: theme.text }]}>Weather in {trip.destination}</Text>
              </View>
              <View style={styles.weatherRow}>
                <View>
                  <Text style={[styles.weatherTemp, { color: theme.text }]}>{weather.tempF}°F</Text>
                  <Text style={[styles.weatherCondition, { color: theme.textMuted }]}>{weather.condition}</Text>
                </View>
                <View style={styles.weatherDetails}>
                  <Text style={[styles.weatherDetail, { color: theme.textMuted }]}>💧 {weather.humidity}% humidity</Text>
                  <Text style={[styles.weatherDetail, { color: theme.textMuted }]}>💨 {weather.windMph} mph wind</Text>
                </View>
              </View>
              <View style={[styles.weatherTipBanner, { backgroundColor: 'rgba(255,255,255,0.5)' }]}>
                <Text style={[styles.weatherTipText, { color: theme.text }]}>{weather.tip}</Text>
              </View>
            </View>

            <Text style={[styles.checklistTitle, { color: theme.text }]}>Smart Checklist</Text>
            <Text style={[styles.checklistSubtitle, { color: theme.textMuted }]}>Auto-generated based on your trip</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item, section }) => (
          <Pressable
            onPress={() => toggleItem(trip.id, item.id)}
            style={[styles.itemRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Ionicons
              name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={item.checked ? theme.secondaryAccent : theme.textMuted}
            />
            <Text
              style={[
                styles.itemLabel,
                { color: item.checked ? theme.textMuted : theme.text, textDecorationLine: item.checked ? 'line-through' : 'none' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 8 },
  tripCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 4 },
  tripHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripDestination: { fontSize: 15, fontWeight: '700' },
  tripDates: { fontSize: 12.5 },
  tripProgress: { fontSize: 12.5, marginTop: 2 },
  weatherCard: { borderRadius: 18, padding: 16, gap: 10 },
  weatherHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTitle: { fontSize: 14, fontWeight: '700' },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherTemp: { fontSize: 24, fontWeight: '800' },
  weatherCondition: { fontSize: 12.5 },
  weatherDetails: { alignItems: 'flex-end', gap: 2 },
  weatherDetail: { fontSize: 11.5 },
  weatherTipBanner: { borderRadius: 12, padding: 10 },
  weatherTipText: { fontSize: 12.5, fontWeight: '600' },
  checklistTitle: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  checklistSubtitle: { fontSize: 12.5, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  itemLabel: { fontSize: 13.5, flex: 1 },
});