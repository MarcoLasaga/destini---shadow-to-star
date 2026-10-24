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

export async function getSocialNotifications(): Promise<SocialNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

