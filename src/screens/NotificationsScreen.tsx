import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import ScreenHeader from '../components/ScreenHeader';
import { NotificationPrefs } from '../types';
import { triggerSmartAlert } from '../services/notificationService';

type Category = 'weather' | 'outfit' | 'laundry' | 'sustainability';
type Target = 'Outfit' | 'Wardrobe' | 'Planner';

interface AppNotification {
  id: string;
  category: Category;
  title: string;
  body: string;
  time: string;
  read: boolean;
  target: Target;
}

const STORAGE_KEY = '@stylesense_notifications_feed';

const FILTERS: { key: 'all' | Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'weather', label: 'Weather' },
  { key: 'outfit', label: 'Outfit' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'sustainability', label: 'Sustainability' },
];

const CATEGORY_META: Record<Category, { icon: keyof typeof Ionicons.glyphMap; target: Target }> = {
  weather: { icon: 'partly-sunny', target: 'Outfit' },
  outfit: { icon: 'sparkles', target: 'Planner' },
  laundry: { icon: 'water', target: 'Wardrobe' },
  sustainability: { icon: 'leaf', target: 'Wardrobe' },
};

const PREFS: { key: keyof NotificationPrefs; label: string; note: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'weatherAlerts', label: 'Weather Alerts', note: 'Live conditions for your outfit', icon: 'partly-sunny-outline' },
  { key: 'sustainabilityTips', label: 'Sustainability Tips', note: 'Re-wear and care nudges', icon: 'leaf-outline' },
  { key: 'outfitReminders', label: 'Outfit Reminders', note: 'Planned looks for tomorrow', icon: 'shirt-outline' },
  { key: 'laundryReminders', label: 'Laundry Reminders', note: 'When pieces need washing', icon: 'water-outline' },
];

const SEED: AppNotification[] = [
  {
    id: 'seed-1',
    category: 'weather',
    title: 'Manila Weather Alert: 31°C & Humid',
    body: 'Breathable cotton tops are prioritized in today’s Hybrid Outfit.',
    time: '8:05 AM',
    read: false,
    target: 'Outfit',
  },
  {
    id: 'seed-2',
    category: 'outfit',
    title: 'Tomorrow’s look is waiting',
    body: 'Plan your Academic outfit for Monday so you’re ready before class.',
    time: '7:30 PM',
    read: false,
    target: 'Planner',
  },
  {
    id: 'seed-3',
    category: 'laundry',
    title: '3 items need washing',
    body: 'Your white hoodie and 2 tees reached their wear limit.',
    time: 'Yesterday',
    read: false,
    target: 'Wardrobe',
  },
  {
    id: 'seed-4',
    category: 'sustainability',
    title: 'Re-wear tip',
    body: 'Re-styling your denim jacket this week saves about 2.5 kg of CO₂.',
    time: 'Yesterday',
    read: true,
    target: 'Wardrobe',
  },
  {
    id: 'seed-5',
    category: 'outfit',
    title: 'New Top-3 outfits ready',
    body: 'Your Hybrid recommendations were refreshed with this week’s feedback.',
    time: 'Mon',
    read: true,
    target: 'Outfit',
  },
];

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { notifications: prefs, toggleNotification } = useSettings();
  const { showToast } = useToast();

  const [items, setItems] = useState<AppNotification[]>(SEED);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [prefsOpen, setPrefsOpen] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setItems(JSON.parse(raw));
      })
      .catch(() => undefined);
  }, []);

  const persist = useCallback((next: AppNotification[]) => {
    setItems(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((n) => n.category === filter)),
    [items, filter]
  );

  const sendTestAlert = async () => {
    await triggerSmartAlert({
      type: 'Weather',
      title: 'Makati Weather Alert: 29°C & Humid',
      body: 'Breathable tops prioritized for today’s Hybrid Outfit.',
      targetRoute: 'Outfit',
    });
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      setItems(JSON.parse(stored));
    }
    showToast('🌤 Makati Weather Alert: 29°C & Humid — notification banner sent!');
  };

  const markAllRead = () => {
    if (unreadCount === 0) {
      showToast('You’re all caught up');
      return;
    }
    persist(items.map((n) => ({ ...n, read: true })));
    showToast('All notifications marked as read');
  };

  const open = (n: AppNotification) => {
    persist(items.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    if (n.target === 'Outfit') navigation.navigate('MainTabs', { screen: 'Outfit' });
    else if (n.target === 'Wardrobe') navigation.navigate('MainTabs', { screen: 'Wardrobe' });
    else navigation.navigate('PlanDay');
  };

  const onToggle = async (key: keyof NotificationPrefs, label: string) => {
    const enabled = await toggleNotification(key);
    showToast(enabled ? `${label} enabled` : `${label} turned off`);
  };

  const cardBg = theme.surface;
  const unreadBg = theme.mode === 'dark' ? '#3A2447' : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Notifications"
        rightElement={
          <Pressable
            onPress={sendTestAlert}
            style={({ pressed }) => [
              styles.testBtn,
              { backgroundColor: theme.secondaryAccent, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={14} color={theme.onAccent} />
            <Text style={[styles.testBtnText, { color: theme.onAccent }]}>Send Test Alert</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Collapsible Alert Preferences */}
        <Animated.View
          entering={FadeInDown.duration(300)}
          layout={LinearTransition}
          style={[styles.card, { backgroundColor: cardBg, borderColor: theme.border }]}
        >
          <Pressable onPress={() => setPrefsOpen((v) => !v)} style={styles.prefsHeader}>
            <View style={[styles.iconBubble, { backgroundColor: theme.badgeBg }]}>
              <Ionicons name="options-outline" size={16} color={theme.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>ALERT PREFERENCES</Text>
              <Text style={[styles.note, { color: theme.textMuted }]}>
                {PREFS.filter((p) => prefs[p.key]).length} of 4 smart alerts on
              </Text>
            </View>
            <Ionicons name={prefsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
          </Pressable>

          {prefsOpen &&
            PREFS.map((p) => (
              <View key={p.key} style={[styles.prefRow, { borderTopColor: theme.border }]}>
                <Ionicons name={p.icon} size={18} color={theme.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.prefLabel, { color: theme.text }]}>{p.label}</Text>
                  <Text style={[styles.note, { color: theme.textMuted }]}>{p.note}</Text>
                </View>
                <Switch
                  value={!!prefs[p.key]}
                  onValueChange={() => onToggle(p.key, p.label)}
                  trackColor={{ false: theme.border, true: theme.mode === 'dark' ? '#FDD78B' : '#4B1D6F' }}
                  thumbColor={theme.mode === 'dark' ? '#24152C' : '#FBF5A7'}
                />
              </View>
            ))}
        </Animated.View>

        {/* Filter pills + Mark all read */}
        <View style={styles.filterHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {unreadCount} UNREAD
          </Text>
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={[styles.markAll, { color: theme.text }]}>Mark All Read</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={({ pressed }) => [
                  styles.pill,
                  {
                    backgroundColor: active ? theme.secondaryAccent : theme.surface,
                    borderColor: active ? theme.secondaryAccent : theme.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: active ? theme.onAccent : theme.text, fontWeight: '700', fontSize: 12.5 }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Notification list */}
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={34} color={theme.textMuted} />
            <Text style={[styles.prefLabel, { color: theme.text }]}>Nothing here yet</Text>
            <Text style={[styles.note, { color: theme.textMuted }]}>Tap “Send Test Alert” to preview a smart alert.</Text>
          </View>
        ) : (
          visible.map((n) => {
            const meta = CATEGORY_META[n.category];
            return (
              <Animated.View key={n.id} entering={FadeInUp.duration(250)} layout={LinearTransition}>
                <Pressable
                  onPress={() => open(n)}
                  style={({ pressed }) => [
                    styles.notif,
                    {
                      backgroundColor: n.read ? cardBg : unreadBg,
                      borderColor: n.read ? theme.border : theme.secondaryAccent,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={[styles.notifIcon, { backgroundColor: '#24152C' }]}>
                    <Ionicons name={meta.icon} size={18} color="#FBF5A7" />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.notifTop}>
                      <Text style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.read && <View style={styles.dot} />}
                    </View>
                    <Text style={[styles.note, { color: theme.textMuted }]}>{n.body}</Text>
                    <View style={styles.notifBottom}>
                      <Text style={[styles.time, { color: theme.textMuted }]}>{n.time}</Text>
                      <View style={[styles.tag, { backgroundColor: theme.mode === 'dark' ? '#4B1D6F' : '#DECFE8' }]}>
                        <Text style={[styles.tagText, { color: theme.mode === 'dark' ? '#FDF3D2' : '#24152C' }]}>
                          {n.target === 'Planner' ? 'Open Planner' : `Open ${n.target}`}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 34, borderRadius: 17 },
  testBtnText: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#24152C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  prefsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  prefLabel: { fontSize: 14.5, fontWeight: '700' },
  note: { fontSize: 12.5, lineHeight: 17 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  markAll: { fontSize: 12.5, fontWeight: '700', textDecorationLine: 'underline' },
  filterScroll: { flexGrow: 0, maxHeight: 44 },
  filterRow: { gap: 8, alignItems: 'center', paddingVertical: 4 },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notif: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 2 },
  notifIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { flex: 1, fontSize: 14.5, fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FDD78B', borderWidth: 1, borderColor: '#24152C' },
  notifBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  time: { fontSize: 11.5 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  tagText: { fontSize: 10.5, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 6, paddingTop: 40 },
});

