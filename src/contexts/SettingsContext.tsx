import React, { createContext, useContext, useState, useCallback } from 'react';
import { NotificationPrefs } from '../types';

interface SettingsContextValue {
  themePreference: 'light' | 'dark';
  setThemePreference: (value: 'light' | 'dark') => void;
  notifications: NotificationPrefs;
  toggleNotification: (key: keyof NotificationPrefs) => void;
  language: string;
  setLanguage: (value: string) => void;
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
  const [themePreference, setThemePreference] = useState<'light' | 'dark'>('light');
  const [notifications, setNotifications] = useState<NotificationPrefs>(defaultNotifications);
  const [language, setLanguage] = useState('English');

  const toggleNotification = useCallback((key: keyof NotificationPrefs) => {
    setNotifications((prev) => {
      if (key === 'all') {
        const nextAll = !prev.all;
        return {
          all: nextAll,
          laundryReminders: nextAll,
          outfitReminders: nextAll,
          weatherAlerts: nextAll,
          sustainabilityTips: nextAll,
        };
      }
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  return (
    <SettingsContext.Provider
      value={{ themePreference, setThemePreference, notifications, toggleNotification, language, setLanguage }}
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