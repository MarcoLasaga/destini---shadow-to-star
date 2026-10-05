import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from './Button.jsx'

const copy = {
  login: {
    line1: 'Welcome',
    line2: 'back.',
    submit: 'Sign In',
    switchText: 'Don’t have an account?',
    switchLabel: 'Sign up',
    switchTo: '/signup',
  },
  signup: {
    line1: 'Start with',
    line2: 'what you own.',
    submit: 'Create Your Account',
    switchText: 'Already have an account?',
    switchLabel: 'Log in',
    switchTo: '/login',
  },
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

function validate(mode, v) {
  if (mode === 'signup' && !v.name.trim()) {
    return { field: 'name', text: 'Please enter your name.' }
  }
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) {
    return { field: 'email', text: 'Please enter a valid email address.' }
  }
  if (!v.password) {
    return { field: 'password', text: 'Please enter your password.' }
  }
  if (mode === 'signup') {
    if (v.password.length < 8) {
      return { field: 'password', text: 'Use at least 8 characters for your password.' }
    }
    if (v.password !== v.confirm) {
      return { field: 'confirm', text: 'Your passwords don’t match.' }
    }
  }
  return null
}

const emptyStatus = { kind: '', text: '', field: '' }

export default function AuthCard({ mode }) {
  const isSignup = mode === 'signup'
  const c = copy[mode]
  const [values, setValues] = useState({ name: '', email: '', password: '', confirm: '' })
  const [status, setStatus] = useState(emptyStatus)

  const update = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    if (status.kind) setStatus(emptyStatus)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const problem = validate(mode, values)
    if (problem) {
      setStatus({ kind: 'error', ...problem })
      document.getElementById(`auth-${mode}-${problem.field}`)?.focus()
      return
    }
    setStatus({
      kind: 'info',
      text: 'This is a design preview. Accounts aren’t connected yet, so nothing was sent.',
      field: '',
    })
  }

  const onGoogle = () => {
    setStatus({ kind: 'info', text: 'Google sign-in isn’t connected yet.', field: '' })
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

          <Button variant="outline" className="auth-google" onClick={onGoogle}>
            Continue with Google
          </Button>
          <p className="auth-or">or use your email</p>

          <form className="auth-form" onSubmit={onSubmit} noValidate aria-label={isSignup ? 'Create account form' : 'Sign in form'}>
            <div className="auth-fields">
              {fields[mode].map((f) => {
                const id = `auth-${mode}-${f.name}`
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
                      aria-invalid={status.field === f.name ? 'true' : undefined}
                      aria-describedby="auth-status"
                    />
                  </div>
                )
              })}
            </div>

            <p id="auth-status" className="auth-status" data-kind={status.kind} role="status" aria-live="polite">
              {status.text}
            </p>

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