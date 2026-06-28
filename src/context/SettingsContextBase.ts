import { createContext } from 'react'

export interface SettingsCtxState {
  outfitReminders: boolean
  plannerReminders: boolean
  weatherAlerts: boolean
  communityActivity: boolean
  styleRecommendations: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  theme: 'light' | 'dark' | 'system'
  accentColor: string
  layout: 'comfortable' | 'compact'
  enableAnimations: boolean
  reducedMotion: boolean
  twoFactor: boolean
  profileVisibility: 'Public' | 'Friends' | 'Private'
  showInCommunity: boolean
  shareActivity: boolean
  language: string
  region: string
  timezone: string
  dateFormat: string
  tempUnit: '°C' | '°F'
  timeFormat: '12h' | '24h'
}

export interface SettingsCtx extends SettingsCtxState {
  set: <K extends keyof SettingsCtxState>(key: K, value: SettingsCtxState[K]) => void
  save: () => void
  isDark: boolean
}

export const SettingsContext = createContext<SettingsCtx | null>(null)
