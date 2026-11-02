import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWeather } from '../hooks/useWeather';
import GreetingHeader from '../components/GreetingHeader';
import WeatherCard from '../components/WeatherCard';
import WardrobeSummary from '../components/WardrobeSummary';
import NotificationsModal from '../components/NotificationsModal';
import { MelMascot, MelOutfit } from '../components/MelMascot';
import { useWardrobe } from '../contexts/WardrobeContext';
import { useProfile } from '../contexts/ProfileContext';
import { getUnreadNotificationCount } from '../services/socialNotificationService';

function outfitForWeather(condition: string, temp: number): MelOutfit {
  const value = condition.toLowerCase();
  if (value.includes('rain') || value.includes('drizzle') || value.includes('storm') || value.includes('thunder')) {
    return 'rain_active';
  }
  if (value.includes('clear') && temp >= 28) return 'casual_sunny';
  if (temp < 23) return 'cool_hoodie';
  if (value.includes('cloud') || value.includes('overcast') || temp < 28) return 'smart_layered';
  return 'casual_sunny';
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const { weather, loading, refresh } = useWeather();
  const { items } = useWardrobe();
  const { profile } = useProfile();
  const [tipIndex, setTipIndex] = useState(0);

  // Activity Notifications Modal State
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(3);

  const fetchNotificationCount = async () => {
    const count = await getUnreadNotificationCount();
    setUnreadNotificationsCount(count);
  };

  useEffect(() => {
    fetchNotificationCount();
  }, [notificationsModalVisible]);

  const temp = weather.tempC ?? Math.round(((weather.tempF - 32) * 5) / 9);
  const melOutfit = outfitForWeather(weather.condition, temp);
  const tips = useMemo(
    () => [
      weather.tip,
      'Air out knits between wears to keep them fresh and extend their life.',
      'Save your favorite looks so Mel can help you remix them later.',
      'Check the UV index before going out—layer light breathable linen on sunny afternoons.',
    ],
    [weather.tip]
  );
  const message = tips[tipIndex % tips.length];
  const stats = {
    items: items.length,
    favorites: items.filter((item) => item.favorite).length,
    toWash: 0,
    categories: new Set(items.map((item) => item.category)).size,
    savedLooks: items.filter((item) => item.favorite).length,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.accent} />}
      >
        <GreetingHeader
          name={profile.firstName || profile.displayName || 'there'}
          hasNotifications={unreadNotificationsCount > 0}
          unreadCount={unreadNotificationsCount}
          onPressNotifications={() => setNotificationsModalVisible(true)}
        />
        <WeatherCard weather={weather} />
        <WardrobeSummary stats={stats} />
      </ScrollView>

      {/* Compact Mel Stylist Dock at Bottom Above Nav Bar (PDF Page 9) */}
      <View style={styles.melBottomDockOuter} pointerEvents="box-none">
        <Pressable
          onPress={() => setTipIndex((current) => current + 1)}
          style={styles.melBottomDock}
        >
          <View style={styles.melMiniAvatarWrap}>
            <MelMascot
              outfit={melOutfit}
              size={44}
              waving={melOutfit === 'rain_active'}
            />
          </View>

          <View style={styles.melDockTextWrap}>
            <View style={styles.melDockHeaderRow}>
              <View style={styles.melDockBadge}>
                <View style={styles.melDockDot} />
                <Text style={styles.melDockLabel}>MEL · DAILY STYLE TIP</Text>
              </View>
              <View style={styles.nextTipBadge}>
                <Text style={styles.nextTipText}>Tap for next</Text>
                <Ionicons name="refresh" size={10} color="#F3F1EF" />
              </View>
            </View>
            <Text style={styles.melDockMessage} numberOfLines={2}>
              {message}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Activity Notifications Modal */}
      <NotificationsModal
        visible={notificationsModalVisible}
        onClose={() => setNotificationsModalVisible(false)}
        onNotificationCountChange={setUnreadNotificationsCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 108,
  },
  melBottomDockOuter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 10,
    zIndex: 10,
  },
  melBottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#364536',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(243, 241, 239, 0.16)',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  melMiniAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(243, 241, 239, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(243, 241, 239, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  melDockTextWrap: {
    flex: 1,
    gap: 3,
  },
  melDockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  melDockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  melDockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E83E35',
  },
  melDockLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(243, 241, 239, 0.78)',
  },
  nextTipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(243, 241, 239, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  nextTipText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F3F1EF',
  },
  melDockMessage: {
    fontSize: 12.5,
    lineHeight: 16.5,
    fontWeight: '600',
    color: '#F3F1EF',
  },
});
