import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp, LinearTransition } from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useToast } from '../contexts/ToastContext';
import ScreenHeader from '../components/ScreenHeader';

type Category = 'weather' | 'outfit' | 'laundry' | 'sustainability';
type Target = 'Outfit' | 'Wardrobe' | 'Planner';

interface AppNotification {
  id: string;
  category: Category;
  title: string;
  body: string;
  createdAt: number;
  time?: string;
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

export function formatRelativeTime(createdAt?: number): string {
  if (!createdAt) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffHours < 48) return 'Yesterday';

  const d = new Date(createdAt);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
}

const now = Date.now();
const SEED: AppNotification[] = [
  {
    id: 'seed-1',
    category: 'weather',
    title: 'Manila Weather Alert: 31°C & Humid',
    body: 'Breathable cotton tops are prioritized in today’s Hybrid Outfit.',
    createdAt: now - 5 * 60 * 1000, // 5 mins ago
    read: false,
    target: 'Outfit',
  },
  {
    id: 'seed-2',
    category: 'outfit',
    title: 'Tomorrow’s look is waiting',
    body: 'Plan your Academic outfit for Monday so you’re ready before class.',
    createdAt: now - 45 * 60 * 1000, // 45 mins ago
    read: false,
    target: 'Planner',
  },
  {
    id: 'seed-3',
    category: 'laundry',
    title: '3 items need washing',
    body: 'Your white hoodie and 2 tees reached their wear limit.',
    createdAt: now - 3 * 3600 * 1000, // 3 hours ago
    read: false,
    target: 'Wardrobe',
  },
  {
    id: 'seed-4',
    category: 'sustainability',
    title: 'Re-wear tip',
    body: 'Re-styling your denim jacket this week saves about 2.5 kg of CO₂.',
    createdAt: now - 24 * 3600 * 1000, // 1 day ago
    read: true,
    target: 'Wardrobe',
  },
  {
    id: 'seed-5',
    category: 'outfit',
    title: 'New Top-3 outfits ready',
    body: 'Your Hybrid recommendations were refreshed with this week’s feedback.',
    createdAt: now - 3 * 24 * 3600 * 1000, // 3 days ago
    read: true,
    target: 'Outfit',
  },
];

export default function NotificationsScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<any>();
  const { showToast } = useToast();

  const [items, setItems] = useState<AppNotification[]>(SEED);
  const [filter, setFilter] = useState<'all' | Category>('all');
  const [, setTick] = useState(0);

  // Re-evaluate relative time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          const upgraded = parsed.map((item: any, idx: number) => ({
            ...item,
            createdAt: item.createdAt || Date.now() - (idx + 1) * 20 * 60 * 1000,
          }));
          setItems(upgraded);
        }
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

  const cardBg = theme.surface;
  const unreadBg = theme.mode === 'dark' ? '#3A2447' : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Notifications" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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
            <Text style={[styles.note, { color: theme.textMuted }]}>Smart alerts for weather, laundry, outfits, and eco-tips will appear here.</Text>
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
                      borderColor: n.read ? theme.border : theme.accentText,
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
                      <Text style={[styles.time, { color: theme.textMuted }]}>{formatRelativeTime(n.createdAt)}</Text>
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
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
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
  prefLabel: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: 6, paddingTop: 40 },
});

