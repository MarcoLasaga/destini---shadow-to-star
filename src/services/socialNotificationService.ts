import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SocialNotification {
  id: string;
  type: 'follow' | 'like' | 'repost';
  actorName: string;
  actorHandle: string;
  actorAvatar?: string | null;
  message: string;
  outfitTitle?: string;
  createdAt: number;
  read: boolean;
}

const STORAGE_KEY = '@stylesense_social_notifications';

const now = Date.now();
const INITIAL_SEEDS: SocialNotification[] = [
  {
    id: 'sn-1',
    type: 'follow',
    actorName: 'Marcus Lin',
    actorHandle: '@marcus.fits',
    message: 'started following you',
    createdAt: now - 5 * 60 * 1000, // 5m ago
    read: false,
  },
  {
    id: 'sn-2',
    type: 'like',
    actorName: 'Elena Vance',
    actorHandle: '@elena.style',
    message: 'liked your White Jacket & White Jeans look',
    outfitTitle: 'White Jacket & White Jeans',
    createdAt: now - 32 * 60 * 1000, // 32m ago
    read: false,
  },
  {
    id: 'sn-3',
    type: 'repost',
    actorName: 'Maya Rodriguez',
    actorHandle: '@maya.in.color',
    message: 'reposted your Casual Streetwear Look',
    outfitTitle: 'Casual Streetwear Look',
    createdAt: now - 2 * 3600 * 1000, // 2h ago
    read: false,
  },
  {
    id: 'sn-4',
    type: 'like',
    actorName: 'Sophia Alcantara',
    actorHandle: '@sophia_mnl',
    message: 'liked your Campus Style Look',
    outfitTitle: 'Campus Style Look',
    createdAt: now - 26 * 3600 * 1000, // 1D ago
    read: true,
  },
  {
    id: 'sn-5',
    type: 'follow',
    actorName: 'Leo Chen',
    actorHandle: '@leochen_daily',
    message: 'started following you',
    createdAt: now - 50 * 3600 * 1000, // 2D ago
    read: true,
  },
];

export async function getSocialNotifications(): Promise<SocialNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SEEDS));
      return INITIAL_SEEDS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_SEEDS;
  }
}

export async function addSocialNotification(
  item: Omit<SocialNotification, 'id' | 'createdAt' | 'read'>
): Promise<SocialNotification> {
  const list = await getSocialNotifications();
  const newItem: SocialNotification = {
    ...item,
    id: `sn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    read: false,
  };
  const updated = [newItem, ...list];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return newItem;
}

export async function markAllNotificationsRead(): Promise<void> {
  const list = await getSocialNotifications();
  const updated = list.map((item) => ({ ...item, read: true }));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const list = await getSocialNotifications();
  return list.filter((n) => !n.read).length;
}

