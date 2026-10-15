import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationPrefs } from '../types';
import { Theme, lightTheme, darkTheme } from '../constants/theme';

const STORAGE_KEY_THEME = '@stylesense_theme_preference';
const STORAGE_KEY_NOTIFS = '@stylesense_notification_prefs';

interface SettingsContextValue {
  themePreference: 'light' | 'dark';
  theme: Theme;
  setThemePreference: (value: 'light' | 'dark') => Promise<void>;
  notifications: NotificationPrefs;
  toggleNotification: (key: keyof NotificationPrefs) => Promise<boolean>;
  language: string;
  setLanguage: (value: string) => void;
  lastActivatedNotification: keyof NotificationPrefs | null;
  clearNotificationBanner: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const defaultNotifications: NotificationPrefs = {
  all: true,
  laundryReminders: true,
  outfitReminders: true,
  weatherAlerts: true,
  sustainabilityTips: true,
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState<NotificationPrefs>(defaultNotifications);
  const [language, setLanguage] = useState('English');
  const [lastActivatedNotification, setLastActivatedNotification] = useState<keyof NotificationPrefs | null>(null);

  // Load persisted settings
  useEffect(() => {
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEY_THEME);
        if (storedTheme === 'dark' || storedTheme === 'light') {
          setThemePreferenceState(storedTheme);
        }

        const storedNotifs = await AsyncStorage.getItem(STORAGE_KEY_NOTIFS);
        if (storedNotifs) {
          const parsed = JSON.parse(storedNotifs);
          setNotifications((prev) => ({ ...prev, ...parsed }));
        }
      } catch (err) {
        console.warn('Failed to load settings from storage', err);
      }
    })();
  }, []);

  const setThemePreference = useCallback(async (value: 'light' | 'dark') => {
    setThemePreferenceState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_THEME, value);
    } catch (err) {
      console.warn('Failed to persist theme preference', err);
    }
  }, []);

  const toggleNotification = useCallback(async (key: keyof NotificationPrefs) => {
    let nextValue = false;
    let nextPrefs: NotificationPrefs = defaultNotifications;

    setNotifications((prev) => {
      if (key === 'all') {
        const nextAll = !prev.all;
        nextValue = nextAll;
        nextPrefs = {
          all: nextAll,
          laundryReminders: nextAll,
          outfitReminders: nextAll,
          weatherAlerts: nextAll,
          sustainabilityTips: nextAll,
        };
      } else {
        const toggled = !prev[key];
        nextValue = toggled;
        nextPrefs = {
          ...prev,
          [key]: toggled,
          all: toggled && prev.laundryReminders && prev.outfitReminders && prev.weatherAlerts && prev.sustainabilityTips,
        };
      }
      return nextPrefs;
    });

    if (nextValue) {
      setLastActivatedNotification(key);
    }

    try {
      await AsyncStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(nextPrefs));
    } catch (err) {
      console.warn('Failed to persist notification preferences', err);
    }

    return nextValue;
  }, []);

  const clearNotificationBanner = useCallback(() => {
    setLastActivatedNotification(null);
  }, []);

  const currentTheme = themePreference === 'dark' ? darkTheme : lightTheme;

  return (
    <SettingsContext.Provider
      value={{
        themePreference,
        theme: currentTheme,
        setThemePreference,
        notifications,
        toggleNotification,
        language,
        setLanguage,
        lastActivatedNotification,
        clearNotificationBanner,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}