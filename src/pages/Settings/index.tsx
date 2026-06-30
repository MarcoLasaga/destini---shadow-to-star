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

const IS_LOGGED_IN = false

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="ss-card" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 18, padding: '30px 34px', marginBottom: 22,
    }}>
      {children}
    </div>
  )
}

function SectionHeader({
  icon: Icon, title, subtitle,
}: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 26 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 13,
        background: 'var(--secondary-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <div style={{ fontFamily: FH, fontSize: 21, color: 'var(--text-heading)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
    </div>
  )
}

function SettingRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '17px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 2 }}>{label}</div>
        {sub && <div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{
        width: 50, height: 27, borderRadius: 14, cursor: 'pointer',
        background: on ? 'var(--accent)' : 'var(--border-solid)',
        position: 'relative', flexShrink: 0,
        transition: 'background 0.22s',
      }}
    >
      <motion.div
        animate={{ x: on ? 25 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 3,
          width: 21, height: 21, borderRadius: '50%',
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
          appearance: 'none', width: '100%', height: 46,
          border: '1.5px solid var(--border-solid)', borderRadius: 11,
          padding: '0 42px 0 15px',
          fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)',
          background: 'var(--bg-input)', outline: 'none', cursor: 'pointer',
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
        onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
    </div>
  )
}

function SelectionCard({
  label, sub, selected, onClick,
}: { label: string; sub?: string; selected: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{
        flex: 1, padding: '18px 20px', borderRadius: 13, cursor: 'pointer',
        border: `1.5px solid ${selected ? 'var(--secondary)' : 'var(--border-solid)'}`,
        background: selected ? 'var(--secondary-soft)' : 'var(--bg-card)',
        transition: 'all 0.18s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
    >
      <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: selected ? 'var(--accent)' : 'var(--text-heading)', marginBottom: sub ? 4 : 0 }}>{label}</div>
      {sub && <div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function SecurityCard({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '15px 17px', borderRadius: 11,
      border: '1px solid var(--border)',
      background: 'var(--bg-page)', cursor: 'pointer',
      transition: 'all 0.18s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-page)' }}
    >
      <Icon size={17} style={{ color: 'var(--text-muted)' }} />
      <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-heading)' }}>{label}</span>
    </div>
  )
}

const THEMES: { value: Theme; label: string; Icon: React.ElementType }[] = [
  { value: 'light',  label: 'Light Mode',     Icon: Sun     },
  { value: 'dark',   label: 'Dark Mode',      Icon: Moon    },
  { value: 'system', label: 'System Default', Icon: Monitor },
]
const LANGUAGES  = ['English', 'Filipino', 'Spanish', 'French', 'Japanese', 'Chinese']
const REGIONS    = ['United States', 'Philippines', 'United Kingdom', 'Canada', 'Australia', 'Japan']
const TIMEZONES  = ['UTC', 'UTC+8 (Manila)', 'UTC-5 (EST)', 'UTC-8 (PST)', 'UTC+1 (CET)', 'UTC+9 (JST)']
const DATE_FMTS  = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

export default function Settings() {
  const navigate = useNavigate()
  const s = useSettings()
  const setSetting = s.set

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const data = await res.json()
          const country = data.address?.country ?? ''
          const city    = data.address?.city ?? data.address?.town ?? ''
          if (country) setSetting('region', country)
          if (city)    setSetting('timezone', `UTC (${city})`)
        } catch { /* keep defaults */ }
      }, () => {})
    }
  }, [setSetting])

  const sectionVariants = {
    hidden:  { opacity: 0, y: 14 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { duration: 0.38, delay: i * 0.07 } }),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper"
      style={{ background: 'var(--bg-page)', minHeight: '100vh', maxWidth: 900, margin: '0 auto' }}
    >
      <div style={{ marginBottom: 36 }}>
        <h1 className="page-title-lg">Settings</h1>
        <p className="page-subtitle">
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

      {/* ── THEME (Accent Color section removed) ──────────────────────── */}
      <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Palette} title="Theme" subtitle="Pick how StyleSense looks on your device." />
          <div style={{ display: 'flex', gap: 16 }}>
            {THEMES.map(({ value, label, Icon }) => (
              <div key={value} onClick={() => s.set('theme', value)}
                style={{
                  flex: 1, border: `1.5px solid ${s.theme === value ? 'var(--secondary)' : 'var(--border-solid)'}`,
                  borderRadius: 13, padding: '20px 18px', cursor: 'pointer',
                  background: s.theme === value ? 'var(--secondary-soft)' : 'var(--bg-card)',
                  transition: 'all 0.22s',
                }}
                onMouseEnter={e => { if (s.theme !== value) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { if (s.theme !== value) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
              >
                <Icon size={20} style={{ color: s.theme === value ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 11 }} />
                <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 13 }}>{label}</div>
                <div style={{
                  height: 38, borderRadius: 9,
                  background: value === 'dark' ? '#2a2318' : value === 'system' ? 'linear-gradient(90deg,var(--bg-page) 50%,#2a2318 50%)' : 'var(--bg-alt)',
                  border: '1px solid var(--border)',
                }} />
              </div>
            ))}
          </div>
        </SectionCard>
      </motion.div>

      {/* ── APPEARANCE ─────────────────────────────────────────────────── */}
      <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Sparkles} title="Appearance" subtitle="Density and motion preferences." />
          <div style={{ display: 'flex', gap: 16, marginBottom: 4 }}>
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

      {/* ── SECURITY ──────────────────────────────────────────────────── */}
      <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Shield} title="Security" subtitle="Protect your account and sessions." />
          {IS_LOGGED_IN ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, marginBottom: 4 }}>
                <SecurityCard icon={Key}        label="Change password"   />
                <SecurityCard icon={Clock}      label="Login activity"    />
                <SecurityCard icon={Smartphone} label="Active sessions"   />
                <SecurityCard icon={Smartphone} label="Device management" />
              </div>
              <SettingRow label="Two-Factor authentication" sub="Extra layer of security at sign-in.">
                <Toggle on={s.twoFactor} onChange={v => s.set('twoFactor', v)} />
              </SettingRow>
              <button style={{
                display: 'flex', alignItems: 'center', gap: 9, marginTop: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: '#e03a3a',
                padding: '8px 0',
              }}
              >
                <LogOut size={16} /> Sign out of all devices
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
                Sign in to access your security settings.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                style={{
                  fontFamily: FF, fontSize: 14, fontWeight: 700,
                  color: '#fff', background: 'var(--accent)',
                  border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
              >Sign In</motion.button>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── PRIVACY ───────────────────────────────────────────────────── */}
      <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Eye} title="Privacy" subtitle="Control what others can see about you." />
          {IS_LOGGED_IN ? (
            <>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 13 }}>
                PROFILE VISIBILITY
              </div>
              <div style={{ display: 'flex', gap: 13, marginBottom: 4 }}>
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
              <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
                Sign in to manage your privacy settings.
              </p>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/login')}
                style={{
                  fontFamily: FF, fontSize: 14, fontWeight: 700,
                  color: '#fff', background: 'var(--accent)',
                  border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
              >Sign In</motion.button>
            </div>
          )}
        </SectionCard>
      </motion.div>

      {/* ── GENERAL ───────────────────────────────────────────────────── */}
      <motion.div custom={5} variants={sectionVariants} initial="hidden" animate="visible">
        <SectionCard>
          <SectionHeader icon={Globe} title="General" subtitle="Language, region and formatting." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>LANGUAGE</div>
              <SSSelect value={s.language} onChange={v => s.set('language', v)} options={LANGUAGES} />
            </div>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>REGION</div>
              <SSSelect value={s.region} onChange={v => s.set('region', v)} options={REGIONS} />
            </div>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>TIMEZONE</div>
              <SSSelect value={s.timezone} onChange={v => s.set('timezone', v)} options={TIMEZONES} />
            </div>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>DATE FORMAT</div>
              <SSSelect value={s.dateFormat} onChange={v => s.set('dateFormat', v)} options={DATE_FMTS} />
            </div>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>TEMPERATURE UNIT</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['°C', '°F'] as const).map(u => (
                  <SelectionCard key={u} label={u} selected={s.tempUnit === u} onClick={() => s.set('tempUnit', u)} />
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>TIME FORMAT</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['12h', '24h'] as const).map(u => (
                  <SelectionCard key={u} label={u} selected={s.timeFormat === u} onClick={() => s.set('timeFormat', u)} />
                ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </motion.div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <motion.button
          whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={s.save}
          style={{
            fontFamily: FF, fontSize: 15, fontWeight: 700,
            color: '#fff', background: 'var(--accent)',
            border: 'none', borderRadius: 30, padding: '14px 32px', cursor: 'pointer',
            boxShadow: 'var(--shadow-md)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
        >
          Save changes
        </motion.button>
      </div>
    </motion.div>
  )
}