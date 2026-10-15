import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSettings } from '../contexts/SettingsContext';
import ScreenHeader from '../components/ScreenHeader';
import ToggleRow from '../components/ToggleRow';
import { NotificationPrefs } from '../types';

const NOTIFICATION_BANNER_INFO: Record<keyof NotificationPrefs, { icon: keyof typeof Ionicons.glyphMap; title: string; message: string; color: string }> = {
  weatherAlerts: {
    icon: 'sunny-outline',
    title: 'Weather Alerts Enabled',
    message: "Live OpenWeatherMap alerts active! You'll receive morning updates on local weather and rain/cold gear tips.",
    color: '#E8833A',
  },
  sustainabilityTips: {
    icon: 'leaf-outline',
    title: 'Sustainability Tips Enabled',
    message: "Eco reminders active! You'll get weekly tips on garment re-wear, carbon reduction, and No New Clothes milestones.",
    color: '#2F8F5B',
  },
  outfitReminders: {
    icon: 'sparkles-outline',
    title: 'Outfit Reminders Enabled',
    message: "Daily outfit reminders active! You'll get suggestions for planned calendar days and morning styling picks.",
    color: '#756E9E',
  },
  laundryReminders: {
    icon: 'water-outline',
    title: 'Laundry Reminders Enabled',
    message: "Laundry tracker active! You'll be alerted immediately when clothes exceed their wash threshold.",
    color: '#3B82F6',
  },
  all: {
    icon: 'notifications-outline',
    title: 'All Notifications Enabled',
    message: "All StyleSense notifications are now active (Weather, Sustainability, Outfits, & Laundry).",
    color: '#756E9E',
  },
};

export default function SettingsScreen() {
  const theme = useAppTheme();
  const {
    themePreference,
    setThemePreference,
    notifications,
    toggleNotification,
    language,
    lastActivatedNotification,
    clearNotificationBanner,
  } = useSettings();

  const [activeBanner, setActiveBanner] = useState<keyof NotificationPrefs | null>(null);

  useEffect(() => {
    if (lastActivatedNotification) {
      setActiveBanner(lastActivatedNotification);
      const timer = setTimeout(() => {
        setActiveBanner(null);
        clearNotificationBanner();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [lastActivatedNotification, clearNotificationBanner]);

  const handleToggle = async (key: keyof NotificationPrefs) => {
    const isNowEnabled = await toggleNotification(key);
    if (isNowEnabled) {
      setActiveBanner(key);
    } else if (activeBanner === key) {
      setActiveBanner(null);
    }
  };

  const bannerDetails = activeBanner ? NOTIFICATION_BANNER_INFO[activeBanner] : null;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {bannerDetails && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(300)}
            style={[styles.banner, { backgroundColor: theme.surface, borderColor: bannerDetails.color }]}
          >
            <View style={[styles.bannerIconWrap, { backgroundColor: bannerDetails.color + '22' }]}>
              <Ionicons name={bannerDetails.icon} size={22} color={bannerDetails.color} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.bannerTitle, { color: theme.text }]}>{bannerDetails.title}</Text>
              <Text style={[styles.bannerMessage, { color: theme.textMuted }]}>{bannerDetails.message}</Text>
            </View>
            <Pressable onPress={() => setActiveBanner(null)} style={styles.bannerClose}>
              <Ionicons name="close" size={16} color={theme.textMuted} />
            </Pressable>
          </Animated.View>
        )}

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="color-palette-outline" size={17} color={theme.secondaryAccent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Appearance</Text>
          </View>
          <View style={styles.themeRow}>
            <Text style={[styles.label, { color: theme.text }]}>Theme</Text>
            <View style={[styles.themeToggle, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
              <Pressable
                onPress={() => setThemePreference('light')}
                style={[styles.themeOption, themePreference === 'light' && { backgroundColor: theme.secondaryAccent }]}
              >
                <Ionicons name="sunny" size={13} color={themePreference === 'light' ? theme.onAccent : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'light' ? theme.onAccent : theme.textMuted }]}>
                  Light
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setThemePreference('dark')}
                style={[styles.themeOption, themePreference === 'dark' && { backgroundColor: theme.secondaryAccent }]}
              >
                <Ionicons name="moon" size={13} color={themePreference === 'dark' ? theme.onAccent : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'dark' ? theme.onAccent : theme.textMuted }]}>
                  Dark
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={17} color={theme.secondaryAccent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Notifications</Text>
          </View>
          <ToggleRow label="All Notifications" value={notifications.all} onToggle={() => handleToggle('all')} />
          <ToggleRow label="Laundry Reminders" value={notifications.laundryReminders} onToggle={() => handleToggle('laundryReminders')} />
          <ToggleRow label="Outfit Reminders" value={notifications.outfitReminders} onToggle={() => handleToggle('outfitReminders')} />
          <ToggleRow label="Weather Alerts" value={notifications.weatherAlerts} onToggle={() => handleToggle('weatherAlerts')} />
          <ToggleRow label="Sustainability Tips" value={notifications.sustainabilityTips} onToggle={() => handleToggle('sustainabilityTips')} />
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe-outline" size={17} color={theme.secondaryAccent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Language</Text>
          </View>
          <View style={styles.themeRow}>
            <Text style={[styles.label, { color: theme.text }]}>Language</Text>
            <View style={[styles.languagePill, { borderColor: theme.border }]}>
              <Text style={[styles.languageText, { color: theme.text }]}>{language}</Text>
              <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={17} color={theme.secondaryAccent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Privacy & Security</Text>
          </View>
          <View style={[styles.privacyNote, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
            <Text style={[styles.privacyText, { color: theme.textMuted }]}>
              Your data is stored securely and never shared with third parties.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  banner: {
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  bannerMessage: {
    fontSize: 12,
    lineHeight: 16,
  },
  bannerClose: {
    padding: 4,
  },
  section: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  label: { fontSize: 14 },
  themeToggle: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  themeOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  themeOptionText: { fontSize: 12.5, fontWeight: '700' },
  languagePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  languageText: { fontSize: 13, fontWeight: '600' },
  privacyNote: { borderRadius: 12, padding: 12 },
  privacyText: { fontSize: 12.5, lineHeight: 18 },
});