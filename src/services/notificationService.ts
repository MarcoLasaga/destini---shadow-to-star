import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigate } from '../navigation/navigationRef';

export type SmartAlertType = 'Weather' | 'Laundry' | 'Outfit' | 'Sustainability';
export type NotificationCategory = 'weather' | 'outfit' | 'laundry' | 'sustainability';
export type NotificationTarget = 'Outfit' | 'Wardrobe' | 'Planner';

export interface SmartAlertOptions {
  type: SmartAlertType;
  title: string;
  body: string;
  targetRoute?: NotificationTarget;
}

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  time: string;
  read: boolean;
  target: NotificationTarget;
}

const STORAGE_KEY_NOTIFS = '@stylesense_notification_prefs';
const STORAGE_KEY_FEED = '@stylesense_notifications_feed';
const CHANNEL_ID = 'stylesense-smart-alerts';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Initialize notification permissions and Android channel.
 * Note: getExpoPushTokenAsync() is intentionally NOT called to avoid warnings in Expo Go.
 */
export async function initNotifications(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'StyleSense Smart Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#24152C',
      });
    }

    Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data;
        const targetRoute = data?.targetRoute;
        if (targetRoute === 'Outfit') {
          navigate('MainTabs', { screen: 'Outfit' });
        } else if (targetRoute === 'Wardrobe') {
          navigate('MainTabs', { screen: 'Wardrobe' });
        } else if (targetRoute === 'Planner') {
          navigate('PlanDay');
        }
      } catch (e) {
        console.warn('[notificationService] Failed handling notification tap:', e);
      }
    });
  } catch (err) {
    console.warn('[notificationService] Failed to initialize notifications:', err);
  }
}

function defaultTargetForType(type: SmartAlertType): NotificationTarget {
  switch (type) {
    case 'Weather':
      return 'Outfit';
    case 'Laundry':
      return 'Wardrobe';
    case 'Outfit':
      return 'Planner';
    case 'Sustainability':
      return 'Wardrobe';
  }
}

function defaultCategoryForType(type: SmartAlertType): NotificationCategory {
  switch (type) {
    case 'Weather':
      return 'weather';
    case 'Laundry':
      return 'laundry';
    case 'Outfit':
      return 'outfit';
    case 'Sustainability':
      return 'sustainability';
  }
}

/**
 * Check if the user's notification preferences allow this alert type.
 */
async function isAlertEnabled(type: SmartAlertType): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_NOTIFS);
    if (!raw) return true; // Default to enabled
    const prefs = JSON.parse(raw);
    if (prefs.all === false) return false;

    switch (type) {
      case 'Weather':
        return prefs.weatherAlerts !== false;
      case 'Laundry':
        return prefs.laundryReminders !== false;
      case 'Outfit':
        return prefs.outfitReminders !== false;
      case 'Sustainability':
        return prefs.sustainabilityTips !== false;
      default:
        return true;
    }
  } catch {
    return true;
  }
}

/**
 * Trigger an immediate smart alert:
 * 1. Validates user notification preferences
 * 2. Fires native OS notification banner
 * 3. Persists alert into in-app notifications feed
 */
export async function triggerSmartAlert(options: SmartAlertOptions): Promise<void> {
  const { type, title, body, targetRoute } = options;

  try {
    const enabled = await isAlertEnabled(type);
    if (!enabled) {
      return;
    }

    const target = targetRoute || defaultTargetForType(type);
    const category = defaultCategoryForType(type);

    // 1. Fire native OS heads-up banner
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { targetRoute: target, type },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });

    // 2. Persist to in-app notification feed
    const rawFeed = await AsyncStorage.getItem(STORAGE_KEY_FEED);
    const currentFeed: AppNotification[] = rawFeed ? JSON.parse(rawFeed) : [];

    const newNotification: AppNotification = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category,
      title,
      body,
      time: 'Just now',
      read: false,
      target,
    };

    const updatedFeed = [newNotification, ...currentFeed];
    await AsyncStorage.setItem(STORAGE_KEY_FEED, JSON.stringify(updatedFeed));
  } catch (err) {
    console.warn('[notificationService] Error triggering smart alert:', err);
  }
}

let weatherAlertTriggeredThisSession = false;

/**
 * Triggers a weather alert banner only once per session.
 */
export async function triggerWeatherAlertOncePerSession(
  temp: number,
  condition: string,
  locationName: string = 'Makati'
): Promise<void> {
  if (weatherAlertTriggeredThisSession) return;
  weatherAlertTriggeredThisSession = true;

  const roundedTemp = Math.round(temp);
  const city = locationName.includes(',') ? locationName.split(',')[0].trim() : locationName;

  await triggerSmartAlert({
    type: 'Weather',
    title: `☀ ${city} Weather Alert: ${roundedTemp}°C & ${condition}`,
    body: "Breathable garments prioritized for today's Hybrid Outfit picks.",
    targetRoute: 'Outfit',
  });
}

/**
 * Schedules a daily recurring 7:30 AM styling reminder notification.
 */
export async function scheduleDailyOutfitReminder(): Promise<void> {
  try {
    const enabled = await isAlertEnabled('Outfit');
    if (!enabled) return;

    // Check if daily reminder is already scheduled to avoid duplicate schedules
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.isDailyOutfitReminder) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Styling Reminder: Today's Look",
        body: 'Check your planned outfit for today!',
        sound: 'default',
        data: { targetRoute: 'Planner', isDailyOutfitReminder: true },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 7,
        minute: 30,
        channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
      },
    });
  } catch (err) {
    console.warn('[notificationService] Failed to schedule daily reminder:', err);
  }
}
