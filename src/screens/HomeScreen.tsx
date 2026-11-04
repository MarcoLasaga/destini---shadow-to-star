import React, { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import { useWeather } from '../hooks/useWeather';
import GreetingHeader from '../components/GreetingHeader';
import WeatherCard from '../components/WeatherCard';
import WardrobeSummary from '../components/WardrobeSummary';
import NotificationsModal from '../components/NotificationsModal';
import { MelMascot, MelOutfit, MelSpeechBubble } from '../components/MelMascot';
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
      'Layer light breathable cotton or linen on warm afternoons.',
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['left', 'right']}>
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

        {/* Standalone Mel Character (Right) & Cute Concise Speech Bubble (Left -> Pointing to Mel) at Bottom of Home Page */}
        <View style={styles.melBottomCompanion}>
          <MelSpeechBubble
            title="MEL · DAILY STYLE TIP"
            message={message}
            position="inline"
            tailDirection="right"
            compact
            onTapNextTip={() => setTipIndex((current) => current + 1)}
          />
          <View style={styles.melCharacterWrap}>
            <MelMascot
              outfit={melOutfit}
              size={54}
              waving={melOutfit === 'rain_active'}
              onPress={() => setTipIndex((current) => current + 1)}
            />
          </View>
        </View>
      </ScrollView>

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
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 22,
  },
  melBottomCompanion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    marginTop: 'auto',
    paddingTop: 16,
    marginBottom: 4,
    gap: 10,
    maxWidth: '94%',
    overflow: 'visible',
  },
  melCharacterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
