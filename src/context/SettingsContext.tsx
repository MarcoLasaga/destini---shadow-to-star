/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type Theme      = 'light' | 'dark' | 'system'
export type Layout     = 'comfortable' | 'compact'
export type Visibility = 'Public' | 'Friends' | 'Private'

interface SettingsState {
  // Notifications
  outfitReminders:    boolean
  plannerReminders:   boolean
  weatherAlerts:      boolean
  communityActivity:  boolean
  styleRecommendations: boolean
  emailNotifications: boolean
  pushNotifications:  boolean
  // Theme
  theme:              Theme
  accentColor:        string
  // Appearance
  layout:             Layout
  enableAnimations:   boolean
  reducedMotion:      boolean
  // Security (shown only when logged in)
  twoFactor:          boolean
  // Privacy
  profileVisibility:  Visibility
  showInCommunity:    boolean
  shareActivity:      boolean
  // General
  language:           string
  region:             string
  timezone:           string
  dateFormat:         string
  tempUnit:           '°C' | '°F'
  timeFormat:         '12h' | '24h'
}

interface SettingsCtx extends SettingsState {
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void
  save: () => void
}

const DEFAULTS: SettingsState = {
  outfitReminders:     true,
  plannerReminders:    true,
  weatherAlerts:       true,
  communityActivity:   false,
  styleRecommendations:true,
  emailNotifications:  false,
  pushNotifications:   true,
  theme:               'light',
  accentColor:         '#ffd586',
  layout:              'comfortable',
  enableAnimations:    true,
  reducedMotion:       false,
  twoFactor:           false,
  profileVisibility:   'Public',
  showInCommunity:     true,
  shareActivity:       true,
  language:            'English',
  region:              'United States',
  timezone:            'UTC',
  dateFormat:          'MM/DD/YYYY',
  tempUnit:            '°C',
  timeFormat:          '12h',
}

function load(): SettingsState {
  try {
    const saved = localStorage.getItem('ss_settings')
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
  } catch { return DEFAULTS }
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(load)

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    const isDark =
      state.theme === 'dark' ||
      (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

    if (isDark) {
      root.setAttribute('data-theme', 'dark')
    } else {
      root.removeAttribute('data-theme')
    }
    root.style.setProperty('--accent', state.accentColor)
  }, [state.theme, state.accentColor])

  // Apply reduced motion
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--motion-duration', state.reducedMotion ? '0.01ms' : '300ms'
    )
  }, [state.reducedMotion])

  const set = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  function save() {
    localStorage.setItem('ss_settings', JSON.stringify(state))
    // Brief flash to confirm
    const el = document.getElementById('ss-save-toast')
    if (el) { el.style.opacity = '1'; setTimeout(() => { el.style.opacity = '0' }, 2000) }
  }

  return <Ctx.Provider value={{ ...state, set, save }}>{children}</Ctx.Provider>
}

export function useSettings() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider')
  return ctx
}