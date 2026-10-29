import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import ToggleRow from '../components/ToggleRow';
import ConfirmDialogModal from '../components/common/ConfirmDialogModal';
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

const ALERT_ITEMS: { key: keyof NotificationPrefs; label: string; note: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'weatherAlerts', label: 'Weather Alerts', note: 'Live conditions for your outfit', icon: 'partly-sunny-outline' },
  { key: 'sustainabilityTips', label: 'Sustainability Tips', note: 'Re-wear and care nudges', icon: 'leaf-outline' },
  { key: 'outfitReminders', label: 'Outfit Reminders', note: 'Planned looks for tomorrow', icon: 'shirt-outline' },
  { key: 'laundryReminders', label: 'Laundry Reminders', note: 'When pieces need washing', icon: 'water-outline' },
];

export default function SettingsScreen() {
  const theme = useAppTheme();
  const {
    themePreference,
    setThemePreference,
    notifications,
    toggleNotification,
    language,
    setLanguage,
    mannequinSkinTone,
    setMannequinSkinTone,
    lastActivatedNotification,
    clearNotificationBanner,
  } = useSettings();
  const { logout } = useAuth();

  const [activeBanner, setActiveBanner] = useState<keyof NotificationPrefs | null>(null);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const isTagalog = language === 'Filipino (Tagalog)';

  const t = {
    settings: isTagalog ? 'Mga Setting' : 'Settings',
    appearance: isTagalog ? 'Hitsura' : 'Appearance',
    theme: isTagalog ? 'Tema' : 'Theme',
    light: isTagalog ? 'Maliwanag' : 'Light',
    dark: isTagalog ? 'Madilim' : 'Dark',
    alertPreferences: isTagalog ? 'Mga Kagustuhan sa Alerto' : 'Alert Preferences',
    alertsActive: isTagalog ? 'ng 4 na smart alert ang aktibo' : 'of 4 smart alerts active',
    language: isTagalog ? 'Wika' : 'Language',
    selectLanguage: isTagalog ? 'Pumili ng Wika' : 'Select Language',
    privacy: isTagalog ? 'Pagkapribado at Seguridad' : 'Privacy & Security',
    privacyNote: isTagalog
      ? 'Ligtas na nakaimbak ang iyong data at hindi kailanman ibinabahagi sa iba.'
      : 'Your data is stored securely and never shared with third parties.',
    signOut: isTagalog ? 'Mag-sign Out' : 'Sign Out',
    signOutTitle: isTagalog ? 'Mag-sign Out' : 'Sign Out',
    signOutMessage: isTagalog
      ? 'Sigurado ka bang nais mong mag-sign out sa iyong StyleSense account?'
      : 'Are you sure you want to sign out of your StyleSense account?',
    cancel: isTagalog ? 'Kanselahin' : 'Cancel',
  };

  const alertItems = [
    {
      key: 'weatherAlerts' as const,
      label: isTagalog ? 'Mga Alerto sa Panahon' : 'Weather Alerts',
      note: isTagalog ? 'Kondisyon ng panahon para sa iyong kasuotan' : 'Live conditions for your outfit',
      icon: 'partly-sunny-outline' as const,
    },
    {
      key: 'sustainabilityTips' as const,
      label: isTagalog ? 'Mga Tip sa Pagpapanatili' : 'Sustainability Tips',
      note: isTagalog ? 'Paalala sa muling pagsuot at pangangalaga' : 'Re-wear and care nudges',
      icon: 'leaf-outline' as const,
    },
    {
      key: 'outfitReminders' as const,
      label: isTagalog ? 'Mga Paalala sa Kasuotan' : 'Outfit Reminders',
      note: isTagalog ? 'Pinaplanong kasuotan para bukas' : 'Planned looks for tomorrow',
      icon: 'shirt-outline' as const,
    },
    {
      key: 'laundryReminders' as const,
      label: isTagalog ? 'Mga Paalala sa Labada' : 'Laundry Reminders',
      note: isTagalog ? 'Kapag kailangan nang labhan ang mga damit' : 'When pieces need washing',
      icon: 'water-outline' as const,
    },
  ];

  const LANGUAGE_OPTIONS = ['English (US)', 'Filipino (Tagalog)', 'English (PH)'];

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
      <ScreenHeader title={t.settings} />
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
            <Ionicons name="color-palette-outline" size={17} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.appearance}</Text>
          </View>
          <View style={styles.themeRow}>
            <Text style={[styles.label, { color: theme.text }]}>{t.theme}</Text>
            <View style={[styles.themeToggle, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
              <Pressable
                onPress={() => setThemePreference('light')}
                style={[styles.themeOption, themePreference === 'light' && { backgroundColor: theme.secondaryAccent }]}
              >
                <Ionicons name="sunny" size={13} color={themePreference === 'light' ? theme.onAccent : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'light' ? theme.onAccent : theme.textMuted }]}>
                  {t.light}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setThemePreference('dark')}
                style={[styles.themeOption, themePreference === 'dark' && { backgroundColor: theme.secondaryAccent }]}
              >
                <Ionicons name="moon" size={13} color={themePreference === 'dark' ? theme.onAccent : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'dark' ? theme.onAccent : theme.textMuted }]}>
                  {t.dark}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="options-outline" size={17} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.alertPreferences}</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                {alertItems.filter((p) => notifications[p.key]).length} {t.alertsActive}
              </Text>
            </View>
          </View>

          {alertItems.map((item, idx) => (
            <View
              key={item.key}
              style={[
                styles.alertPrefRow,
                { borderTopColor: theme.border, borderTopWidth: idx === 0 ? 0 : 1 },
              ]}
            >
              <View style={[styles.alertIconWrap, { backgroundColor: theme.badgeBg }]}>
                <Ionicons name={item.icon} size={18} color={theme.text} />
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[styles.alertPrefLabel, { color: theme.text }]}>{item.label}</Text>
                <Text style={[styles.alertPrefNote, { color: theme.textMuted }]}>{item.note}</Text>
              </View>
              <Switch
                value={!!notifications[item.key]}
                onValueChange={() => handleToggle(item.key)}
                trackColor={{ false: theme.border, true: theme.secondaryAccent }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="globe-outline" size={17} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.language}</Text>
          </View>
          <View style={styles.themeRow}>
            <Text style={[styles.label, { color: theme.text }]}>{t.language}</Text>
            <Pressable
              onPress={() => setLanguageModalVisible(true)}
              style={[styles.languagePill, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.languageText, { color: theme.text }]}>{language}</Text>
              <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={17} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.privacy}</Text>
          </View>
          <View style={[styles.privacyNote, { backgroundColor: theme.mode === 'dark' ? '#232329' : '#F4F1EA' }]}>
            <Text style={[styles.privacyText, { color: theme.textMuted }]}>
              {t.privacyNote}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => setLogoutModalVisible(true)}
          style={[styles.logoutButton, { borderColor: '#E5484D33', backgroundColor: theme.surface }]}
        >
          <Ionicons name="log-out-outline" size={17} color="#E5484D" />
          <Text style={styles.logoutText}>{t.signOut}</Text>
        </Pressable>
      </ScrollView>

      {/* Language Selection Modal */}
      {languageModalVisible && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable style={styles.modalBackdrop} onPress={() => setLanguageModalVisible(false)}>
            <View style={[styles.modalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{t.selectLanguage}</Text>
                <Pressable onPress={() => setLanguageModalVisible(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={20} color={theme.textMuted} />
                </Pressable>
              </View>
              <View style={styles.languageOptionsList}>
                {LANGUAGE_OPTIONS.map((opt) => {
                  const isSelected = language === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        setLanguage(opt);
                        setLanguageModalVisible(false);
                      }}
                      style={[
                        styles.languageOptionRow,
                        {
                          backgroundColor: isSelected ? (theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8') : theme.surface,
                          borderColor: isSelected ? theme.activeCardBorder : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.languageOptionLabel,
                          {
                            color: isSelected ? (theme.mode === 'dark' ? '#FDF3D2' : '#24152C') : theme.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {opt}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={19} color={theme.mode === 'dark' ? '#FDF3D2' : '#24152C'} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </View>
      )}

      <ConfirmDialogModal
        visible={logoutModalVisible}
        variant="danger"
        title={t.signOutTitle}
        message={t.signOutMessage}
        confirmText={t.signOut}
        cancelText={t.cancel}
        onConfirm={() => {
          setLogoutModalVisible(false);
          logout();
        }}
        onCancel={() => setLogoutModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 16 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  logoutText: {
    color: '#E5484D',
    fontWeight: '700',
    fontSize: 14.5,
  },
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
  sectionSubtitle: { fontSize: 12, marginTop: 1 },
  alertPrefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertPrefLabel: { fontSize: 14, fontWeight: '700' },
  alertPrefNote: { fontSize: 12, lineHeight: 16 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  skinRow: { flexDirection: 'row', gap: 8 },
  skinSwatch: { width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: '#FFFFFF' },
  skinSelected: { borderColor: '#264C3B', transform: [{ scale: 1.18 }] },
  label: { fontSize: 14 },
  themeToggle: { flexDirection: 'row', borderRadius: 999, padding: 3, gap: 2 },
  themeOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  themeOptionText: { fontSize: 12.5, fontWeight: '700' },
  languagePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  languageText: { fontSize: 13, fontWeight: '600' },
  privacyNote: { borderRadius: 12, padding: 12 },
  privacyText: { fontSize: 12.5, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalClose: {
    padding: 4,
  },
  languageOptionsList: {
    gap: 10,
  },
  languageOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  languageOptionLabel: {
    fontSize: 14.5,
  },
});
