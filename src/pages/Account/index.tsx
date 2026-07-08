import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shirt, Heart, CalendarDays, Sparkles,
  Camera, LogOut, Check,
} from 'lucide-react'
import { useAuth } from '../../context'
import { useWardrobe } from '../../context/WardrobeContext'
import { resolveAvatarUrl } from '../../utils/profileAvatar'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const GENDERS     = ['Male', 'Female', 'Non-Binary', 'Prefer-Not-To-Say']
const BODY_TYPES  = ['Slim', 'Athletic', 'Average', 'Curvy', 'Plus-Size']
const SIZES       = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const STYLES      = ['Casual', 'Formal', 'Sporty', 'Streetwear', 'Minimalist', 'Bohemian', 'Vintage', 'Classic']
const COLORS      = ['Black', 'White', 'Blue', 'Navy', 'Cream', 'Olive', 'Rose', 'Gray', 'Brown', 'Beige', 'Red', 'Green']
const OCCASIONS   = ['School', 'Work', 'Gym', 'Party', 'Date', 'Outdoor', 'Everyday']

// ── Shared pill ───────────────────────────────────────────────────────────────
function Pill({
  label, active, onClick, circle,
}: { label: string; active: boolean; onClick?: () => void; circle?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        fontFamily: FF, fontSize: 14, fontWeight: 600,
        padding: circle ? '0' : '7px 18px',
        width: circle ? 44 : 'auto', height: circle ? 44 : 'auto',
        borderRadius: circle ? '50%' : 30,
        border: 'none', cursor: onClick ? 'pointer' : 'default',
        background: active ? '#2b1f0e' : 'var(--bg-alt)',
        color: active ? '#fff' : 'var(--text-body)',
        transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (onClick && !active) { e.currentTarget.style.background = 'var(--secondary-soft)'; e.currentTarget.style.color = 'var(--accent)' } }}
      onMouseLeave={e => { if (onClick && !active) { e.currentTarget.style.background = 'var(--bg-alt)'; e.currentTarget.style.color = 'var(--text-body)' } }}
    >
      {label}
    </button>
  )
}

// ── Section label ─────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 11 }}>
      {children}
    </div>
  )
}

// ── Text input ────────────────────────────────────────────────────────────────
function TxtInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', height: 48, border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '0 16px', fontFamily: FF, fontSize: 15, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }}
      onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
      onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Account() {
  const navigate    = useNavigate()
  const { user, updateUser, logout, isLoggedIn } = useAuth()
  const { items }   = useWardrobe()
  const fileRef     = useRef<HTMLInputElement>(null)

  // Local editable state (mirrors user)
  const [name,      setName]      = useState(user?.name      ?? '')
  const [age,       setAge]       = useState(user?.age       ?? '')
  const [gender,    setGender]    = useState(user?.gender    ?? '')
  const [bodyType,  setBodyType]  = useState(user?.bodyType  ?? '')
  const [size,      setSize]      = useState(user?.size      ?? '')
  const [styles,    setStyles]    = useState<string[]>(user?.styles   ?? [])
  const [colors,    setColors]    = useState<string[]>(user?.colors   ?? [])
  const [occasions, setOccasions] = useState<string[]>(user?.occasions ?? [])
  const [saved,     setSaved]     = useState(false)
  const [logoutOpen,setLogoutOpen]= useState(false)

  if (!isLoggedIn || !user) {
    navigate('/login'); return null
  }

  function toggleArr(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function handleAvatarFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => updateUser({ avatarUrl: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleSave() {
    updateUser({ name, age, gender, bodyType, size, styles, colors, occasions, preferredStyle: styles[0] ?? '' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2400)
  }

  function handleLogout() {
    setLogoutOpen(false); logout(); navigate('/')
  }

  const avatarSrc = resolveAvatarUrl(user.avatarUrl)

  const STATS = [
    { label: 'TOTAL CLOTHES',   value: items.length, Icon: Shirt        },
    { label: 'SAVED OUTFITS',   value: 4,            Icon: Heart        },
    { label: 'WEARS (14D)',      value: 17,           Icon: CalendarDays },
    { label: 'STYLE MATCHES',   value: 1,            Icon: Sparkles     },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh', maxWidth: 900, margin: '0 auto' }}
    >

      {/* ── Profile header card ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 30px', marginBottom: 22, display: 'flex', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}
      >
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border-solid)' }}>
            <img src={avatarSrc} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.94 }}
            onClick={() => fileRef.current?.click()}
            style={{ position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Camera size={14} style={{ color: '#fff' }} />
          </motion.button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleAvatarFile(e.target.files[0]) }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: FH, fontSize: 32, color: 'var(--text-heading)', marginBottom: 4 }}>{user.name}</h1>
          <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 14 }}>
            {user.email} · Member since {user.memberSince}
          </p>
          {(user.preferredStyle || user.size) && (
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {user.preferredStyle && (
                <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--text-body)', background: 'var(--bg-alt)', borderRadius: 30, padding: '5px 15px' }}>
                  {user.preferredStyle}
                </span>
              )}
              {user.size && (
                <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--secondary-soft)', border: '1px solid var(--secondary)', borderRadius: 30, padding: '5px 15px' }}>
                  Size {user.size}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Log Out link */}
        <button onClick={() => setLogoutOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, marginTop: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03a3a' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <LogOut size={17} /> Log Out
        </button>
      </motion.div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="ss-grid-4" style={{ marginBottom: 26 }}>
        {STATS.map(({ label, value, Icon }, i) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: i * 0.07 }}
            whileHover={{ y: -3, boxShadow: 'var(--shadow-md)' }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', transition: 'border-color 0.2s, box-shadow 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
              <Icon size={18} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontFamily: FH, fontSize: 32, color: 'var(--text-heading)', lineHeight: 1 }}>{value}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Preferences card ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.28 }}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '30px 32px', marginBottom: 26 }}
      >
        <h2 style={{ fontFamily: FH, fontSize: 26, color: 'var(--text-heading)', marginBottom: 28 }}>Preferences</h2>

        {/* Name + Age */}
        <div className="ss-grid-2" style={{ marginBottom: 26 }}>
          <div>
            <Label>NAME</Label>
            <TxtInput value={name} onChange={setName} placeholder="Display name" />
          </div>
          <div>
            <Label>AGE</Label>
            <TxtInput value={age} onChange={setAge} placeholder="Your age" />
          </div>
        </div>

        {/* Gender + Body Type */}
        <div className="ss-grid-2" style={{ marginBottom: 26 }}>
          <div>
            <Label>GENDER</Label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {GENDERS.map(g => (
                <Pill key={g} label={g} active={gender === g} onClick={() => setGender(g)} />
              ))}
            </div>
          </div>
          <div>
            <Label>BODY TYPE</Label>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {BODY_TYPES.map(b => (
                <Pill key={b} label={b} active={bodyType === b} onClick={() => setBodyType(b)} />
              ))}
            </div>
          </div>
        </div>

        {/* Current Size */}
        <div style={{ marginBottom: 26 }}>
          <Label>CURRENT SIZE</Label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {SIZES.map(s => (
              <Pill key={s} label={s} active={size === s} onClick={() => setSize(s)} circle />
            ))}
          </div>
        </div>

        {/* Preferred Styles */}
        <div style={{ marginBottom: 26 }}>
          <Label>PREFERRED STYLES</Label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <Pill key={s} label={s} active={styles.includes(s)} onClick={() => toggleArr(styles, s, setStyles)} />
            ))}
          </div>
        </div>

        {/* Favorite Colors */}
        <div style={{ marginBottom: 26 }}>
          <Label>FAVORITE COLORS</Label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <Pill key={c} label={c} active={colors.includes(c)} onClick={() => toggleArr(colors, c, setColors)} />
            ))}
          </div>
        </div>

        {/* Occasion Preferences */}
        <div style={{ marginBottom: 32 }}>
          <Label>OCCASION PREFERENCES</Label>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {OCCASIONS.map(o => (
              <Pill key={o} label={o} active={occasions.includes(o)} onClick={() => toggleArr(occasions, o, setOccasions)} />
            ))}
          </div>
        </div>

        {/* Save button */}
        <motion.button
          whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          style={{ width: '100%', height: 56, background: saved ? '#2a9d5c' : '#2b1f0e', color: '#fff', border: 'none', borderRadius: 30, fontFamily: FF, fontSize: 15.5, fontWeight: 700, cursor: 'pointer', transition: 'background 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
          onMouseEnter={e => { if (!saved) e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = saved ? '#2a9d5c' : '#2b1f0e' }}
        >
          {saved ? <><Check size={18} /> Saved!</> : 'Save Profile & Update Recommendations'}
        </motion.button>
      </motion.div>

      {/* ── Logout confirmation modal ────────────────────────────────────── */}
      <AnimatePresence>
        {logoutOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setLogoutOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.24, ease: [0.34, 1.1, 0.64, 1] }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '32px 30px 26px', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}
            >
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(224,58,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <LogOut size={26} style={{ color: '#e03a3a' }} />
              </div>
              <h2 style={{ fontFamily: FH, fontSize: 22, color: 'var(--text-heading)', marginBottom: 9 }}>Log Out?</h2>
              <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.55 }}>Are you sure you want to log out of StyleSense?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setLogoutOpen(false)}
                  style={{ flex: 1, fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '11px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
                >Cancel</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleLogout}
                  style={{ flex: 1, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: '#e03a3a', border: 'none', borderRadius: 11, padding: '11px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#c02020' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#e03a3a' }}
                >Log Out</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}