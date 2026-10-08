import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from './Button.jsx'

const copy = {
  login: { line1: 'Welcome', line2: 'back.', submit: 'Sign In', switchText: 'Don’t have an account?', switchLabel: 'Sign up', switchTo: '/signup' },
  signup: { line1: 'Start with', line2: 'what you own.', submit: 'Create Your Account', switchText: 'Already have an account?', switchLabel: 'Log in', switchTo: '/login' },
}

const fields = {
  login: [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
  ],
  signup: [
    { name: 'name', label: 'Name', type: 'text', autoComplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'confirm', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  ],
}

const EMAIL = /^\S+@\S+\.\S+$/

function validate(mode, v) {
  const e = {}
  if (mode === 'signup' && !v.name.trim()) e.name = 'Please enter your name.'
  if (!v.email.trim()) e.email = 'Please enter your email.'
  else if (!EMAIL.test(v.email.trim())) e.email = 'Please enter a valid email address.'
  if (!v.password) e.password = 'Please enter your password.'
  else if (mode === 'signup' && v.password.length < 8) e.password = 'Use at least 8 characters.'
  if (mode === 'signup') {
    if (!v.confirm) e.confirm = 'Please confirm your password.'
    else if (v.password !== v.confirm) e.confirm = 'Your passwords don’t match.'
  }
  return e
}

const KEY = 'stylesense-preview-emails'
const readEmails = () => {
  try { return JSON.parse(sessionStorage.getItem(KEY)) || [] } catch { return [] }
}
const writeEmails = (list) => {
  try { sessionStorage.setItem(KEY, JSON.stringify(list)) } catch { /* storage unavailable */ }
}

export default function AuthCard({ mode }) {
  const navigate = useNavigate()
  const isSignup = mode === 'signup'
  const c = copy[mode]
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState('')

  const update = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((er) => ({ ...er, [name]: undefined }))
    if (notice) setNotice('')
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const problems = validate(mode, values)
    setErrors(problems)
    const first = Object.keys(problems)[0]
    if (first) {
      document.getElementById(`auth-${mode}-${first}`)?.focus()
      return
    }
    if (isSignup) {
      const email = values.email.trim().toLowerCase()
      const known = readEmails()
      if (known.includes(email)) {
        navigate('/account-created/failed', {
          state: { reason: 'This email already has an account in this preview. Try signing in instead.' },
        })
        return
      }
      writeEmails([...known, email])
      navigate('/account-created', { state: { name: values.name.trim() } })
    } else {
      navigate('/logged-in')
    }
  }

  return (
    <section className="auth" aria-label={isSignup ? 'Create account' : 'Sign in'}>
      <div className="auth-card">
        <div className="auth-aside">
          <p className="eyebrow">Your style journey</p>
          <h1>
            {c.line1} <span>{c.line2}</span>
          </h1>
          <p className="auth-note">
            Your web account keeps your profile ready. Your wardrobe and daily outfits live in the StyleSense mobile app.
          </p>
        </div>

        <div className="auth-panel">
          <nav className="auth-tabs" aria-label="Account">
            <Link to="/login" aria-current={isSignup ? undefined : 'page'}>Sign In</Link>
            <Link to="/signup" aria-current={isSignup ? 'page' : undefined}>Create Account</Link>
          </nav>

          <Button variant="outline" className="auth-google" onClick={() => setNotice('Google sign-in isn’t connected yet.')}>
            Continue with Google
          </Button>
          <p className="auth-or">or use your email</p>

          <form className="auth-form" onSubmit={onSubmit} noValidate aria-label={isSignup ? 'Create account form' : 'Sign in form'}>
            <div className="auth-fields">
              {fields[mode].map((f) => {
                const id = `auth-${mode}-${f.name}`
                const err = errors[f.name]
                return (
                  <div className="auth-field" key={f.name}>
                    <label htmlFor={id}>{f.label}</label>
                    <input
                      id={id}
                      className="auth-input"
                      name={f.name}
                      type={f.type}
                      autoComplete={f.autoComplete}
                      value={values[f.name]}
                      onChange={update}
                      aria-invalid={err ? 'true' : undefined}
                      aria-describedby={`${id}-err`}
                    />
                    <p id={`${id}-err`} className="fld-err">{err}</p>
                  </div>
                )
              })}
            </div>

            <p id="auth-status" className="auth-status" role="status" aria-live="polite">{notice}</p>

            <Button variant="primary" type="submit" className="auth-submit">
              {c.submit}
            </Button>

            <p className="auth-switch">
              {c.switchText} <Link to={c.switchTo}>{c.switchLabel}</Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  )
}