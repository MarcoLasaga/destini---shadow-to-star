import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell, Palette, Sparkles, Shield, Eye, Globe,
  Sun, Moon, Monitor, Key, Clock, Smartphone,
  LogOut, ChevronDown,
} from 'lucide-react'
import { useSettings, type Theme, type Visibility } from '../../context'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// Mock: no user logged in by default
const IS_LOGGED_IN = false

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="ss-card" style={{
      background: '#fffcf8',
      border: '1px solid rgba(160,120,70,0.15)',
      borderRadius: 16,
      padding: '28px 32px',
      marginBottom: 20,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({
  icon: Icon, title, subtitle,
}: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 24 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: 'rgba(255,213,134,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} style={{ color: '#ffd586' }} />
      </div>
      <div>
        <div style={{ fontFamily: FH, fontSize: 20, color: '#2b1f0e', marginBottom: 3 }}>{title}</div>
        <div style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>{subtitle}</div>
      </div>
    </div>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '16px 0',
      borderBottom: '1px solid rgba(160,120,70,0.08)',
    }}>
      <div>
        <div style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#2b1f0e', marginBottom: 2 }}>{label}</div>
        {sub && <div style={{ fontFamily: FF, fontSize: 13, color: '#9c866c' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{
        width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
        background: on ? '#2b1f0e' : '#e0d0be',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.22s',
      }}
    >
      <motion.div
        animate={{ x: on ? 24 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 3,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        }}
      />
    </div>
  )
}

function SSSelect({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none', width: '100%', height: 44,
          border: '1.5px solid #e0d0be', borderRadius: 10,
          padding: '0 40px 0 14px',
          fontFamily: FF, fontSize: 14, color: '#2b1f0e',
          background: '#fffcf8', outline: 'none', cursor: 'pointer',
        }}
        onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
        onBlur={e  => { e.target.style.borderColor = '#e0d0be'; e.target.style.boxShadow = 'none' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#9c866c', pointerEvents: 'none' }} />
    </div>
  )
}

function SelectionCard({
  label, sub, selected, onClick,
}: { label: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{
        flex: 1, padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
        border: `1.5px solid ${selected ? '#ffd586' : '#e0d0be'}`,
        background: selected ? 'rgba(255,213,134,0.12)' : '#fffcf8',
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = '#e0d0be' }}
    >
      <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: selected ? '#e07020' : '#2b1f0e', marginBottom: sub ? 4 : 0 }}>{label}</div>
      {sub && <div style={{ fontFamily: FF, fontSize: 12.5, color: '#9c866c' }}>{sub}</div>}
    </div>
  )
}

function SecurityCard({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 16px', borderRadius: 10,
      border: '1px solid rgba(160,120,70,0.15)',
      background: '#faf7f2', cursor: 'pointer',
      transition: 'all 0.18s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,140,0,0.06)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,120,70,0.15)'; (e.currentTarget as HTMLElement).style.background = '#faf7f2' }}
    >
      <Icon size={16} style={{ color: '#9c866c' }} />
      <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e' }}>{label}</span>
    </div>
  )
}

const ACCENT_COLORS = ['#ffd586', '#e03a3a', '#22a55e', '#4f6ef7', '#9b5de5', '#00b4d8']
const THEMES: { value: Theme; label: string; Icon: React.ElementType }[] = [
  { value: 'light',  label: 'Light Mode',     Icon: Sun     },
  { value: 'dark',   label: 'Dark Mode',      Icon: Moon    },
  { value: 'system', label: 'System Default', Icon: Monitor },
]
const LANGUAGES  = ['English', 'Filipino', 'Spanish', 'French', 'Japanese', 'Chinese']
const REGIONS    = ['United States', 'Philippines', 'United Kingdom', 'Canada', 'Australia', 'Japan']
const TIMEZONES  = ['UTC', 'UTC+8 (Manila)', 'UTC-5 (EST)', 'UTC-8 (PST)', 'UTC+1 (CET)', 'UTC+9 (JST)']
const DATE_FMTS  = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

// ── Main component ────────────────────────────────────────────────────────────
export default function Settings() {
  const navigate = useNavigate()
  const s = useSettings()
  const { set } = s

  // Auto-detect location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const data = await res.json()
          const country = data.address?.country ?? ''
          const city    = data.address?.city ?? data.address?.town ?? ''
          if (country) set('region', country)
          if (city)    set('timezone', `UTC (${city})`)
        } catch { /* keep defaults */ }
      }, () => {})
    }
  }, [set])

  const sectionVariants = {
    hidden:  { opacity: 0, y: 14 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.38, delay: i * 0.07 } }),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 100px', maxWidth: 860, margin: '0 auto' }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: FH, fontSize: 38, color: '#2b1f0e', marginBottom: 6 }}>Settings</h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c' }}>
          Configure notifications, appearance, privacy, and account preferences.
        </p>
      </div>

      {/* ── NOTIFICATIONS ─────────────────────────────────────────────── */}
      <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Bell} title="Notifications" subtitle="Choose what StyleSense lets you know about." />
          {[
            { key: 'outfitReminders'     as const, label: 'Outfit reminders',      sub: 'Daily nudges to plan your look.'                        },
            { key: 'plannerReminders'    as const, label: 'Planner reminders',     sub: 'Get pinged about your scheduled outfits.'               },
            { key: 'weatherAlerts'       as const, label: 'Weather alerts',        sub: 'Heads up when conditions change.'                       },
            { key: 'communityActivity'   as const, label: 'New community activity',sub: 'Likes, ratings and comments on your shared outfits.'    },
            { key: 'styleRecommendations'as const, label: 'Style recommendations', sub: 'Fresh AI-powered outfit ideas.'                         },
            { key: 'emailNotifications'  as const, label: 'Email notifications',   sub: undefined                                                },
            { key: 'pushNotifications'   as const, label: 'Push notifications',    sub: undefined                                                },
          ].map(({ key, label, sub }) => (
            <SettingRow key={key} label={label} sub={sub}>
              <Toggle on={s[key] as boolean} onChange={v => s.set(key, v)} />
            </SettingRow>
          ))}
        </SectionCard>
      </motion.div>

      {/* ── THEME ──────────────────────────────────────────────────────── */}
      <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Palette} title="Theme" subtitle="Pick how StyleSense looks on your device." />

          {/* Theme cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 28 }}>
            {THEMES.map(({ value, label, Icon }) => (
              <div key={value} onClick={() => s.set('theme', value)}
                style={{
                  flex: 1, border: `1.5px solid ${s.theme === value ? '#ffd586' : '#e0d0be'}`,
                  borderRadius: 12, padding: '18px 16px', cursor: 'pointer',
                  background: s.theme === value ? 'rgba(255,213,134,0.1)' : '#fffcf8',
                  transition: 'all 0.22s',
                }}
                onMouseEnter={e => { if (s.theme !== value) (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
                onMouseLeave={e => { if (s.theme !== value) (e.currentTarget as HTMLElement).style.borderColor = '#e0d0be' }}
              >
                <Icon size={18} style={{ color: s.theme === value ? '#e07020' : '#9c866c', marginBottom: 10 }} />
                <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', marginBottom: 12 }}>{label}</div>
                {/* Preview strip */}
                <div style={{
                  height: 36, borderRadius: 8,
                  background: value === 'dark' ? '#2a231a' : value === 'system' ? 'linear-gradient(90deg,#faf7f2 50%,#2a231a 50%)' : '#f0ede8',
                  border: '1px solid rgba(160,120,70,0.12)',
                }} />
              </div>
            ))}
          </div>

          {/* Accent colors */}
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 12 }}>
            ACCENT COLOR
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {ACCENT_COLORS.map(c => (
              <div key={c} onClick={() => s.set('accentColor', c)}
                style={{
                  width: 34, height: 34, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: s.accentColor === c ? `3px solid ${c}` : '3px solid transparent',
                  outline: s.accentColor === c ? `2px solid #2b1f0e` : '2px solid transparent',
                  transition: 'all 0.18s', transform: s.accentColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </SectionCard>
      </motion.div>

      {/* ── APPEARANCE ─────────────────────────────────────────────────── */}
      <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Sparkles} title="Appearance" subtitle="Density and motion preferences." />

          <div style={{ display: 'flex', gap: 14, marginBottom: 4 }}>
            <SelectionCard
              label="Comfortable View" sub="Spacious layout with breathing room."
              selected={s.layout === 'comfortable'}
              onClick={() => s.set('layout', 'comfortable')}
            />
            <SelectionCard
              label="Compact View" sub="Denser layout — see more at once."
              selected={s.layout === 'compact'}
              onClick={() => s.set('layout', 'compact')}
            />
          </div>

          <SettingRow label="Enable animations" sub="Subtle transitions throughout the app.">
            <Toggle on={s.enableAnimations} onChange={v => s.set('enableAnimations', v)} />
          </SettingRow>
          <SettingRow label="Reduced motion" sub="Minimize non-essential animation.">
            <Toggle on={s.reducedMotion} onChange={v => s.set('reducedMotion', v)} />
          </SettingRow>
        </SectionCard>
      </motion.div>

      {/* ── SECURITY (logged-in only) ──────────────────────────────────── */}
      <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Shield} title="Security" subtitle="Protect your account and sessions." />
          {IS_LOGGED_IN ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
                <SecurityCard icon={Key}        label="Change password"   />
                <SecurityCard icon={Clock}      label="Login activity"    />
                <SecurityCard icon={Smartphone} label="Active sessions"   />
                <SecurityCard icon={Smartphone} label="Device management" />
              </div>
              <SettingRow label="Two-Factor authentication" sub="Extra layer of security at sign-in.">
                <Toggle on={s.twoFactor} onChange={v => s.set('twoFactor', v)} />
              </SettingRow>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#e03a3a',
                padding: '8px 0',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c02020' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e03a3a' }}
              >
                <LogOut size={15} /> Sign out of all devices
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>
                Sign in to access your security settings.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/account')}
                style={{
                  fontFamily: FF, fontSize: 13.5, fontWeight: 700,
                  color: '#fff', background: '#2b1f0e',
                  border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              >Sign In</motion.button>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── PRIVACY (logged-in only) ───────────────────────────────────── */}
      <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Eye} title="Privacy" subtitle="Control what others can see about you." />
          {IS_LOGGED_IN ? (
            <>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 12 }}>
                PROFILE VISIBILITY
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                {(['Public', 'Friends', 'Private'] as Visibility[]).map(v => (
                  <SelectionCard key={v} label={v} selected={s.profileVisibility === v} onClick={() => s.set('profileVisibility', v)} />
                ))}
              </div>
              <SettingRow label="Show me in the community feed" sub={undefined}>
                <Toggle on={s.showInCommunity} onChange={v => s.set('showInCommunity', v)} />
              </SettingRow>
              <SettingRow label="Share activity (wears, plans)" sub={undefined}>
                <Toggle on={s.shareActivity} onChange={v => s.set('shareActivity', v)} />
              </SettingRow>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>
                Sign in to manage your privacy settings.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/account')}
                style={{
                  fontFamily: FF, fontSize: 13.5, fontWeight: 700,
                  color: '#fff', background: '#2b1f0e',
                  border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              >Sign In</motion.button>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── GENERAL ────────────────────────────────────────────────────── */}
      <motion.div custom={5} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Globe} title="General" subtitle="Language, region and formatting." />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Language */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                <span>LANGUAGE</span>
              </div>
              <SSSelect value={s.language} onChange={v => s.set('language', v)} options={LANGUAGES} />
            </div>

            {/* Region */}
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                REGION
              </div>
              <SSSelect value={s.region} onChange={v => s.set('region', v)} options={REGIONS} />
            </div>

            {/* Timezone */}
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                TIMEZONE
              </div>
              <SSSelect value={s.timezone} onChange={v => s.set('timezone', v)} options={TIMEZONES} />
            </div>

            {/* Date format */}
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                DATE FORMAT
              </div>
              <SSSelect value={s.dateFormat} onChange={v => s.set('dateFormat', v)} options={DATE_FMTS} />
            </div>

            {/* Temperature unit */}
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                TEMPERATURE UNIT
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['°C', '°F'] as const).map(u => (
                  <SelectionCard key={u} label={u} selected={s.tempUnit === u} onClick={() => s.set('tempUnit', u)} />
                ))}
              </div>
            </div>

            {/* Time format */}
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>
                TIME FORMAT
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['12h', '24h'] as const).map(u => (
                  <SelectionCard key={u} label={u} selected={s.timeFormat === u} onClick={() => s.set('timeFormat', u)} />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={s.save}
          style={{
            fontFamily: FF, fontSize: 14.5, fontWeight: 700,
            color: '#fff', background: '#ffd586',
            border: 'none', borderRadius: 30, padding: '13px 30px', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,213,134,0.4)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffd586' }}
        >
          Save changes
        </motion.button>
      </div>
    </motion.div>
  )
}