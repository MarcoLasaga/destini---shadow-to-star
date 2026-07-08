import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSettings } from '../contexts/SettingsContext';
import ScreenHeader from '../components/ScreenHeader';
import ToggleRow from '../components/ToggleRow';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const { themePreference, setThemePreference, notifications, toggleNotification, language } = useSettings();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
                <Ionicons name="sunny" size={13} color={themePreference === 'light' ? '#FFFFFF' : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'light' ? '#FFFFFF' : theme.textMuted }]}>
                  Light
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setThemePreference('dark')}
                style={[styles.themeOption, themePreference === 'dark' && { backgroundColor: theme.secondaryAccent }]}
              >
                <Ionicons name="moon" size={13} color={themePreference === 'dark' ? '#FFFFFF' : theme.textMuted} />
                <Text style={[styles.themeOptionText, { color: themePreference === 'dark' ? '#FFFFFF' : theme.textMuted }]}>
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
          <ToggleRow label="All Notifications" value={notifications.all} onToggle={() => toggleNotification('all')} />
          <ToggleRow label="Laundry Reminders" value={notifications.laundryReminders} onToggle={() => toggleNotification('laundryReminders')} />
          <ToggleRow label="Outfit Reminders" value={notifications.outfitReminders} onToggle={() => toggleNotification('outfitReminders')} />
          <ToggleRow label="Weather Alerts" value={notifications.weatherAlerts} onToggle={() => toggleNotification('weatherAlerts')} />
          <ToggleRow label="Sustainability Tips" value={notifications.sustainabilityTips} onToggle={() => toggleNotification('sustainabilityTips')} />
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
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 4 },
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