import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { supabase } from '../../integrations/supabase/client'
import { useAuth } from '../../context'

const FF = 'Baloo Tamma 2, sans-serif'

function GoogleIcon({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.97h3.88c2.27-2.09 3.58-5.17 3.58-8.79z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.97c-1.07.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.1-6.68-4.92H1.32v3.09C3.29 21.3 7.34 24 12 24z"/>
      <path fill="#FBBC05" d="M5.32 14.36c-.24-.72-.38-1.49-.38-2.36s.14-1.64.38-2.36V6.55H1.32C.48 8.23 0 10.06 0 12s.48 3.77 1.32 5.45l4-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.34 0 3.29 2.7 1.32 6.55l4 3.09c.94-2.82 3.57-4.89 6.68-4.89z"/>
    </svg>
  )
}

function FieldInput({ label, icon: Icon, type = 'text', value, onChange, placeholder, error, rightSlot }: {
  label: string; icon: React.ElementType; type?: string; value: string
  onChange: (v: string) => void; placeholder: string; error?: string; rightSlot?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 9 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <Icon size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: '100%', height: 48, border: `1.5px solid ${error ? '#e03a3a' : 'var(--border-solid)'}`, borderRadius: 13, padding: '0 16px 0 42px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          onFocus={e => { if (!error) { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' } }}
          onBlur={e  => { if (!error) { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' } }}
        />
        {rightSlot}
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <AlertCircle size={13} style={{ color: '#e03a3a' }} />
          <span style={{ fontFamily: FF, fontSize: 12.5, color: '#e03a3a' }}>{error}</span>
        </div>
      )}
    </div>
  )
}

export default function Signup() {
  const navigate = useNavigate()
  const { isLoggedIn, user: authUser, isAdmin } = useAuth()

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPwd,     setShowPwd]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors,      setErrors]      = useState<{ name?: string; email?: string; password?: string; confirm?: string; general?: string }>({})
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    if (isLoggedIn && authUser) {
      if (isAdmin) {
        navigate('/admin')
      } else {
        navigate('/wardrobe')
      }
    }
  }, [isLoggedIn, authUser, isAdmin, navigate])

  function getErrorMessage(error: any): string {
    if (!error) return 'An unknown error occurred'
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    if (typeof error === 'object') {
      if ('message' in error && error.message) return String(error.message)
      if ('error_description' in error && error.error_description) return String(error.error_description)
      if ('error' in error && typeof error.error === 'string') return error.error
      
      const str = error.toString ? error.toString() : ''
      if (str && str !== '[object Object]') return str
    }
    return 'An error occurred. Please check the browser console for details.'
  }

  function validate() {
    const next: typeof errors = {}
    if (!name.trim()) next.name = 'Name is required'
    if (!email.trim()) next.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address'
    if (!password) next.password = 'Password is required'
    else if (password.length < 6) next.password = 'Password must be at least 6 characters'
    if (!confirm) next.confirm = 'Please confirm your password'
    else if (confirm !== password) next.confirm = 'Passwords do not match'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setErrors(prev => ({ ...prev, general: undefined }))

    try {
      const redirectUrl = `${window.location.origin}/`
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: name,
          }
        }
      })

      if (error) {
        setErrors(prev => ({ ...prev, general: getErrorMessage(error) }))
        setLoading(false)
        return
      }

      alert('Signup successful! If email verification is enabled, please verify your email; otherwise, you can now log in.')
      navigate('/login')
    } catch (err: any) {
      setErrors(prev => ({ ...prev, general: getErrorMessage(err) }))
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setErrors(prev => ({ ...prev, general: undefined }))
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err: any) {
      setErrors(prev => ({ ...prev, general: getErrorMessage(err) }))
      setLoading(false)
    }
  }

  async function handleFacebook() {
    setLoading(true)
    setErrors(prev => ({ ...prev, general: undefined }))
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (err: any) {
      setErrors(prev => ({ ...prev, general: getErrorMessage(err) }))
      setLoading(false)
    }
  }

  const pwdToggle = (show: boolean, toggle: () => void) => (
    <button type="button" onClick={toggle}
      style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3 }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
    >
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '70px 24px 80px' }}
    >
      <div style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>

        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0 }}
          className="page-title-lg" style={{ marginBottom: 9 }}
        >Create Account</motion.h1>

        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.36, delay: 0.06 }}
          className="page-subtitle" style={{ marginBottom: 34 }}
        >Start organizing your wardrobe</motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 22, padding: '34px 30px', textAlign: 'left', boxShadow: 'var(--shadow-sm)' }}
        >
          {errors.general && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(224,58,58,0.1)', borderRadius: 10, marginBottom: 18 }}>
              <AlertCircle size={16} style={{ color: '#e03a3a', flexShrink: 0 }} />
              <span style={{ fontFamily: FF, fontSize: 13, color: '#e03a3a', fontWeight: 600 }}>{errors.general}</span>
            </div>
          )}

          {/* Social OAuth Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
            {/* Google */}
            <motion.button type="button" whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleGoogle}
              disabled={loading}
              style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 30, cursor: 'pointer', fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.boxShadow = '0 4px 14px var(--secondary-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <GoogleIcon /> Google
            </motion.button>

            {/* Facebook */}
            <motion.button type="button" whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={handleFacebook}
              disabled={loading}
              style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 30, cursor: 'pointer', fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.boxShadow = '0 4px 14px var(--secondary-soft)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Facebook
            </motion.button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', color: 'var(--text-muted)' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <FieldInput label="Name"     icon={User} value={name}     onChange={setName}     placeholder="Your name"        error={errors.name}     />
            <FieldInput label="Email"    icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" error={errors.email} />
            <FieldInput label="Password" icon={Lock} type={showPwd ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="••••••••" error={errors.password}
              rightSlot={pwdToggle(showPwd, () => setShowPwd(p => !p))}
            />
            <FieldInput label="Confirm Password" icon={Lock} type={showConfirm ? 'text' : 'password'} value={confirm} onChange={setConfirm} placeholder="••••••••" error={errors.confirm}
              rightSlot={pwdToggle(showConfirm, () => setShowConfirm(p => !p))}
            />

            <motion.button type="submit" whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
              disabled={loading}
              style={{ width: '100%', height: 52, marginTop: 5, background: loading ? 'var(--text-muted)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: 30, fontFamily: FF, fontSize: 15.5, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = loading ? 'var(--text-muted)' : 'var(--accent)' }}
            >{loading ? 'Creating account…' : 'Sign Up'}</motion.button>
          </form>
        </motion.div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.3 }}
          style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginTop: 26 }}
        >
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
          >Sign In</Link>
        </motion.p>
      </div>
    </motion.div>
  )
}