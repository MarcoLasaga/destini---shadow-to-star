import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { WeatherData } from '../types';

const ICONS: Record<WeatherData['icon'], keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny',
  'partly-cloudy': 'partly-sunny',
  cloudy: 'cloud',
  rainy: 'rainy',
  stormy: 'thunderstorm',
  snowy: 'snow',
};

export default function WeatherCard({ weather }: { weather: WeatherData }) {
  return (
    <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.wrapper}>
      <LinearGradient
        colors={['#E8F0C8', '#D6E7D0', '#C9E0E8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.topRow}>
          <View style={styles.leftBlock}>
            <View style={styles.iconCircle}>
              <Ionicons name={ICONS[weather.icon]} size={26} color="#4A4A4A" />
            </View>
            <View style={styles.tempBlock}>
              <Text style={styles.temp}>{weather.tempF}°F</Text>
              <Text style={styles.condition}>{weather.condition}</Text>
            </View>
          </View>

          <View style={styles.rightBlock}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color="#5A5A5A" />
              <Text style={styles.locationText}>{weather.location}</Text>
            </View>
            <Text style={styles.detailText}>Feels {weather.feelsLikeF}°F</Text>
            <View style={styles.detailRow}>
              <Ionicons name="water" size={12} color="#5A7FC1" />
              <Text style={styles.detailText}> {weather.humidity}% · 💨 {weather.windMph}mph</Text>
            </View>
          </View>
        </View>

        <View style={styles.tipBanner}>
          <Ionicons name="shirt-outline" size={15} color="#4A4A4A" />
          <Text style={styles.tipText}>{weather.tip}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, marginTop: 20 },
  card: { borderRadius: 24, padding: 18 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  leftBlock: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tempBlock: { marginTop: 0 },
  temp: { fontSize: 26, fontWeight: '800', color: '#2B2B2B' },
  condition: { fontSize: 13, color: '#4A4A4A', marginTop: 2 },
  rightBlock: { alignItems: 'flex-end' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  locationText: { fontSize: 12, color: '#3E3E3E', fontWeight: '600' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  detailText: { fontSize: 12, color: '#4A4A4A' },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  tipText: { fontSize: 13, color: '#3E3E3E', fontWeight: '500', marginLeft: 8 },
});