import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../hooks/useAppTheme';
import { usePacking } from '../contexts/PackingContext';
import { fetchWeatherByCoords, placeholderWeather } from '../services/weatherService';
import { WeatherData, RootStackParamList, PackingItem } from '../types';
import ScreenHeader from '../components/ScreenHeader';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';

export default function PackingTripDetailScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'PackingTripDetail'>>();
  const { getTrip, toggleItem, deleteTrip } = usePacking();
  const [weather, setWeather] = useState<WeatherData>(placeholderWeather);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        <ScreenHeader title="Trip Checklist" />
        <View style={styles.notFound}>
          <Text style={{ color: theme.text }}>Trip not found.</Text>
        </View>
      </View>
    );
  }

  const handleDeleteTrip = async () => {
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      setDeleteConfirmVisible(false);
      navigation.goBack();
    } finally {
      setDeleting(false);
    }
  };

  const packedCount = trip.checklist.filter((i) => i.checked).length;
  const progressPercent = trip.checklist.length > 0 ? Math.round((packedCount / trip.checklist.length) * 100) : 0;

  const categories: PackingItem['category'][] = ['Clothing', 'Footwear', 'Accessories', 'Toiletries', 'Essentials'];
  const sections = categories
    .map((category) => ({ title: category, data: trip.checklist.filter((i) => i.category === category) }))
    .filter((section) => section.data.length > 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Packing Assistant"
        rightElement={
          <Pressable
            onPress={() => setDeleteConfirmVisible(true)}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={19} color="#E5484D" />
          </Pressable>
        }
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 4 }}>
            {/* Trip Summary Card */}
            <View style={[styles.tripCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.tripHeaderRow}>
                <Ionicons name="location" size={17} color={theme.secondaryAccent} />
                <Text style={[styles.tripDestination, { color: theme.text }]}>{trip.destination}</Text>
              </View>

              <View style={styles.badgesRow}>
                {trip.occasion && (
                  <View style={[styles.badgePill, { backgroundColor: theme.primaryAccent }]}>
                    <Text style={styles.badgePillText}>{trip.occasion}</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: trip.packingMode === 'heavy' ? '#756E9E22' : '#2F8F5B22' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgePillText,
                      { color: trip.packingMode === 'heavy' ? theme.secondaryAccent : '#2F8F5B' },
                    ]}
                  >
                    {trip.packingMode === 'heavy' ? 'Heavy Mode' : 'Light Capsule'}
                  </Text>
                </View>
                {trip.tripDays && (
                  <View style={[styles.badgePill, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}>
                    <Text style={[styles.badgePillText, { color: theme.text }]}>{trip.tripDays} Days</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.tripDates, { color: theme.textMuted }]}>
                {new Date(trip.startDate).toDateString()} — {new Date(trip.endDate).toDateString()}
              </Text>

              {/* Progress bar */}
              <View style={styles.progressWrap}>
                <View style={styles.progressLabelRow}>
                  <Text style={[styles.tripProgress, { color: theme.text }]}>
                    {packedCount} / {trip.checklist.length} packed
                  </Text>
                  <Text style={[styles.tripProgressPercent, { color: theme.secondaryAccent }]}>
                    {progressPercent}%
                  </Text>
                </View>
                <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: theme.secondaryAccent }]} />
                </View>
              </View>
            </View>

            {/* Destination Weather Card */}
            {(() => {
              const tempC = weather.tempC ?? Math.round((weather.tempF - 32) * (5 / 9));
              const windKmh = weather.windKmh ?? Math.round(weather.windMph * 1.60934);
              return (
                <View style={[styles.weatherCard, { backgroundColor: theme.mode === 'dark' ? '#171D22' : '#F2ECE4', borderColor: theme.border, borderWidth: 1 }]}>
                  <View style={styles.weatherHeader}>
                    <Ionicons name="partly-sunny-outline" size={16} color={theme.secondaryAccent} />
                    <Text style={[styles.weatherTitle, { color: theme.text }]}>OpenWeatherMap Forecast (PH Metric)</Text>
                  </View>
                  <View style={styles.weatherRow}>
                    <View>
                      <Text style={[styles.weatherTemp, { color: theme.text }]}>{tempC}°C</Text>
                      <Text style={[styles.weatherCondition, { color: theme.textMuted }]}>{weather.condition}</Text>
                    </View>
                    <View style={styles.weatherDetails}>
                      <Text style={[styles.weatherDetail, { color: theme.textMuted }]}>💧 {weather.humidity}% humidity</Text>
                      <Text style={[styles.weatherDetail, { color: theme.textMuted }]}>💨 {windKmh} km/h wind</Text>
                    </View>
                  </View>
                  <View style={[styles.weatherTipBanner, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                    <Text style={[styles.weatherTipText, { color: theme.text }]}>{weather.tip}</Text>
                  </View>
                </View>
              );
            })()}

            <Text style={[styles.checklistTitle, { color: theme.text }]}>Clean Wardrobe Checklist</Text>
            <Text style={[styles.checklistSubtitle, { color: theme.textMuted }]}>
              Tailored from your clean garments for {trip.destination} ({trip.occasion || 'Casual'})
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{section.title.toUpperCase()}</Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggleItem(trip.id, item.id)}
            style={({ pressed }) => [
              styles.itemRow,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons
              name={item.checked ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={item.checked ? '#2F8F5B' : theme.textMuted}
            />
            <Text
              style={[
                styles.itemLabel,
                {
                  color: item.checked ? theme.textMuted : theme.text,
                  textDecorationLine: item.checked ? 'line-through' : 'none',
                },
              ]}
            >
              {item.label}
            </Text>
            {item.colorTag && (
              <View
                style={[
                  styles.colorChip,
                  {
                    backgroundColor: theme.mode === 'dark' ? '#24262E' : '#EFEAE2',
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={[styles.colorChipText, { color: theme.textMuted }]}>
                  {item.colorTag}
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />

      {/* Delete Trip Checklist Confirmation Dialog */}
      <ConfirmDialogModal
        visible={deleteConfirmVisible}
        variant="danger"
        title="Delete Trip Checklist"
        message={`Are you sure you want to delete the packing checklist for "${trip.destination}"? This action cannot be undone.`}
        confirmText="Delete Trip"
        cancelText="Cancel"
        loading={deleting}
        onConfirm={handleDeleteTrip}
        onCancel={() => setDeleteConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 36, gap: 8 },
  tripCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  tripHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripDestination: { fontSize: 17, fontWeight: '800' },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 2 },
  badgePill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgePillText: { fontSize: 11, fontWeight: '700' },
  tripDates: { fontSize: 12.5 },
  progressWrap: { gap: 6, marginTop: 4 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripProgress: { fontSize: 12.5, fontWeight: '600' },
  tripProgressPercent: { fontSize: 12.5, fontWeight: '800' },
  progressBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  weatherCard: { borderRadius: 18, padding: 16, gap: 10 },
  weatherHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherTitle: { fontSize: 13.5, fontWeight: '700' },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  weatherTemp: { fontSize: 24, fontWeight: '800' },
  weatherCondition: { fontSize: 12.5 },
  weatherDetails: { alignItems: 'flex-end', gap: 2 },
  weatherDetail: { fontSize: 11.5 },
  weatherTipBanner: { borderRadius: 12, padding: 10 },
  weatherTipText: { fontSize: 12, fontWeight: '600' },
  checklistTitle: { fontSize: 16, fontWeight: '800', marginTop: 6 },
  checklistSubtitle: { fontSize: 12.5, marginBottom: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  itemLabel: { fontSize: 13.5, flex: 1 },
  colorChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  colorChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});