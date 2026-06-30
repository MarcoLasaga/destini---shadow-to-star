import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// ── Google "G" logo (official 4-colour SVG, inline) ──────────────────────────
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.97h3.88c2.27-2.09 3.58-5.17 3.58-8.79z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.97c-1.07.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.92H1.32v3.09C3.29 21.3 7.34 24 12 24z"/>
      <path fill="#FBBC05" d="M5.32 14.36c-.24-.72-.38-1.49-.38-2.36s.14-1.64.38-2.36V6.55H1.32C.48 8.23 0 10.06 0 12s.48 3.77 1.32 5.45l4-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.34 0 3.29 2.7 1.32 6.55l4 3.09c.94-2.82 3.57-4.89 6.68-4.89z"/>
    </svg>
  )
}

// ── Reusable input ─────────────────────────────────────────────────────────────
function FieldInput({
  label, icon: Icon, type = 'text', value, onChange, placeholder, error, rightSlot,
}: {
  label: string
  icon: React.ElementType
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  error?: string
  rightSlot?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 7 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', height: 46,
            border: `1.5px solid ${error ? '#e03a3a' : 'var(--border-solid)'}`,
            borderRadius: 12, padding: '0 14px 0 38px',
            fontFamily: FF, fontSize: 14, color: 'var(--text-body)',
            background: 'var(--bg-input)', outline: 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => {
            if (!error) {
              e.target.style.borderColor = 'var(--accent)'
              e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)'
            }
          }}
          onBlur={e => {
            if (!error) {
              e.target.style.borderColor = 'var(--border-solid)'
              e.target.style.boxShadow = 'none'
            }
          }}
        />
        {rightSlot}
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
          <AlertCircle size={12} style={{ color: '#e03a3a' }} />
          <span style={{ fontFamily: FF, fontSize: 12, color: '#e03a3a' }}>{error}</span>
        </div>
      )}
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [errors,   setErrors]   = useState<{ email?: string; password?: string }>({})
  const [loading,  setLoading]  = useState(false)

  function validate(): boolean {
    const next: typeof errors = {}
    if (!email.trim()) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address'
    if (!password) next.password = 'Password is required'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    // TODO: connect to real auth endpoint here (POST /api/auth/login)
    setTimeout(() => {
      setLoading(false)
      navigate('/')
    }, 900)
  }

  function handleGoogleSignIn() {
    // TODO: wire up real Google OAuth flow here (e.g. Google Identity Services / Firebase Auth)
    console.log('Google Sign In clicked — connect OAuth provider here')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '64px 24px 80px' }}
    >
      <div style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            borderRadius: 30, padding: '5px 16px', marginBottom: 18,
            background: 'rgba(255,213,134,0.18)',
            fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
            color: 'var(--accent-hover)',
          }}
        >
          <Sparkles size={12} /> STYLESENSE
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.06 }}
          style={{ fontFamily: FH, fontSize: 36, color: 'var(--text-heading)', marginBottom: 8 }}
        >
          Welcome Back
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.1 }}
          style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}
        >
          Sign in to your digital closet
        </motion.p>

        {/* Form card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14 }}
          style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '32px 28px', textAlign: 'left',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Google button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={handleGoogleSignIn}
            style={{
              width: '100%', height: 48,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)',
              borderRadius: 30, cursor: 'pointer',
              fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              marginBottom: 20,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--accent-hover)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(255,140,0,0.15)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-solid)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <GoogleIcon /> Continue with Google
          </motion.button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <FieldInput
              label="Email" icon={Mail} type="email"
              value={email} onChange={setEmail}
              placeholder="you@example.com"
              error={errors.email}
            />
            <FieldInput
              label="Password" icon={Lock}
              type={showPwd ? 'text' : 'password'}
              value={password} onChange={setPassword}
              placeholder="••••••••"
              error={errors.password}
              rightSlot={
                <button type="button" onClick={() => setShowPwd(p => !p)}
                  style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18, marginTop: -8 }}>
              <Link to="/forgot-password"
                style={{ fontFamily: FF, fontSize: 12.5, fontWeight: 600, color: 'var(--accent-hover)', textDecoration: 'none' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
              >
                Forgot Password?
              </Link>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
              disabled={loading}
              style={{
                width: '100%', height: 50,
                background: loading ? 'var(--text-muted)' : '#2b1f0e',
                color: '#fff', border: 'none', borderRadius: 30,
                fontFamily: FF, fontSize: 15, fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = loading ? 'var(--text-muted)' : '#2b1f0e' }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </motion.button>
          </form>
        </motion.div>

        {/* Footer link */}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
          style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', marginTop: 24 }}
        >
          Don't have an account?{' '}
          <Link to="/signup"
            style={{ color: 'var(--accent-hover)', fontWeight: 700, textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
          >
            Sign Up
          </Link>
        </motion.p>
      </div>
    </motion.div>
  )
}