import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { WeatherData } from '../types';
import { useAppTheme } from '../hooks/useAppTheme';

const ICONS: Record<WeatherData['icon'], keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny',
  'partly-cloudy': 'partly-sunny',
  cloudy: 'cloud',
  rainy: 'rainy',
  stormy: 'thunderstorm',
  snowy: 'snow',
};

export default function WeatherCard({ weather }: { weather: WeatherData }) {
  const theme = useAppTheme();
  const isDark = theme.mode === 'dark';

  const gradientColors: [string, string, string] = isDark
    ? ['#1A241E', '#161E1A', '#131917']
    : ['#E8F0C8', '#D6E7D0', '#C9E0E8'];

  const borderColor = isDark ? '#2A362E' : 'rgba(54, 69, 54, 0.1)';
  const iconCircleBg = isDark ? 'rgba(138, 184, 150, 0.14)' : 'rgba(255, 255, 255, 0.6)';
  const iconCircleBorder = isDark ? 'rgba(138, 184, 150, 0.25)' : 'rgba(255, 255, 255, 0.8)';
  const mainIconColor = isDark ? '#98C4A4' : '#364536';

  const tempColor = isDark ? '#F3F1EF' : '#2B2B2B';
  const conditionColor = isDark ? '#B2BCB5' : '#4A4A4A';
  const locationColor = isDark ? '#E4E2DD' : '#3E3E3E';
  const detailColor = isDark ? '#9BA59E' : '#4A4A4A';
  const waterIconColor = isDark ? '#7AA2E3' : '#5A7FC1';
  const mutedIconColor = isDark ? '#8AB896' : '#5A5A5A';

  const tipBannerBg = isDark ? '#202B24' : 'rgba(255, 255, 255, 0.55)';
  const tipBannerBorder = isDark ? '#2E3D33' : 'rgba(255, 255, 255, 0.7)';
  const tipIconColor = isDark ? '#98C4A4' : '#364536';
  const tipTextColor = isDark ? '#E4E2DD' : '#3E3E3E';

  return (
    <Animated.View entering={FadeInDown.duration(450).delay(80)} style={styles.wrapper}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { borderColor, borderWidth: 1 }]}
      >
        <View style={styles.topRow}>
          <View style={styles.leftBlock}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: iconCircleBg, borderColor: iconCircleBorder },
              ]}
            >
              <Ionicons name={ICONS[weather.icon] || 'partly-sunny'} size={25} color={mainIconColor} />
            </View>
            <View style={styles.tempBlock}>
              <Text style={[styles.temp, { color: tempColor }]}>
                {weather.tempC ?? Math.round((weather.tempF - 32) * (5 / 9))}°C
              </Text>
              <Text style={[styles.condition, { color: conditionColor }]}>
                {weather.condition}
              </Text>
            </View>
          </View>

          <View style={styles.rightBlock}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={mutedIconColor} />
              <Text style={[styles.locationText, { color: locationColor }]} numberOfLines={1}>
                {weather.location}
              </Text>
            </View>
            <Text style={[styles.detailText, { color: detailColor }]}>
              Feels {weather.feelsLikeC ?? Math.round((weather.feelsLikeF - 32) * (5 / 9))}°C
            </Text>
            <View style={styles.detailRow}>
              <Ionicons name="water" size={12} color={waterIconColor} />
              <Text style={[styles.detailText, { color: detailColor }]}>
                {' '}
                {weather.humidity}% ·{' '}
              </Text>
              <Ionicons name="speedometer-outline" size={12} color={mutedIconColor} />
              <Text style={[styles.detailText, { color: detailColor }]}>
                {' '}
                {weather.windKmh ?? Math.round(weather.windMph * 1.60934)} km/h
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.tipBanner,
            { backgroundColor: tipBannerBg, borderColor: tipBannerBorder },
          ]}
        >
          <Ionicons name="shirt-outline" size={15} color={tipIconColor} />
          <Text style={[styles.tipText, { color: tipTextColor }]}>{weather.tip}</Text>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 20, marginTop: 16 },
  card: {
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  leftBlock: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  tempBlock: { marginTop: 0 },
  temp: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  condition: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  rightBlock: { alignItems: 'flex-end', flex: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  locationText: { fontSize: 12, fontWeight: '700', maxWidth: 160 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  detailText: { fontSize: 12, fontWeight: '500' },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  tipText: { fontSize: 12.5, fontWeight: '600', marginLeft: 8, flex: 1, lineHeight: 17 },
});
