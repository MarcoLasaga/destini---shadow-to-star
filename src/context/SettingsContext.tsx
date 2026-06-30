import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { SettingsContext } from './SettingsContextBase'
import type { SettingsCtx, SettingsCtxState } from './SettingsContextBase'

export type Theme = 'light' | 'dark' | 'system'
export type Layout = 'comfortable' | 'compact'
export type Visibility = 'Public' | 'Friends' | 'Private'

type SettingsState = SettingsCtxState

const DEFAULTS: SettingsState = {
  outfitReminders: true,
  plannerReminders: true,
  weatherAlerts: true,
  communityActivity: false,
  styleRecommendations: true,
  emailNotifications: false,
  pushNotifications: true,
  theme: 'light',
  layout: 'comfortable',
  enableAnimations: true,
  reducedMotion: false,
  twoFactor: false,
  profileVisibility: 'Public',
  showInCommunity: true,
  shareActivity: true,
  language: 'English',
  region: 'United States',
  timezone: 'UTC',
  dateFormat: 'MM/DD/YYYY',
  tempUnit: '°C',
  timeFormat: '12h',
}

function load(): SettingsState {
  try {
    const saved = localStorage.getItem('ss_settings')
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SettingsState>(load)
  const isDark = resolveIsDark(state.theme)

  useEffect(() => {
    const root = document.documentElement
    if (resolveIsDark(state.theme)) root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }, [state.theme])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--motion-duration', state.reducedMotion ? '0.01ms' : '0.22s'
    )
  }, [state.reducedMotion])

  useEffect(() => {
    if (state.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const root = document.documentElement
      if (mq.matches) root.setAttribute('data-theme', 'dark')
      else root.removeAttribute('data-theme')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [state.theme])

  const set = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const save = useCallback(() => {
    localStorage.setItem('ss_settings', JSON.stringify(state))
    const el = document.getElementById('ss-save-toast')
    if (el) {
      el.style.opacity = '1'
      setTimeout(() => { el.style.opacity = '0' }, 2200)
    }
  }, [state])

  return (
    <SettingsContext.Provider value={{ ...state, set, save, isDark } as SettingsCtx}>
      {children}
    </SettingsContext.Provider>
  )
}