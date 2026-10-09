import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from './Button.jsx'
import AsciiHanger from './AsciiHanger.jsx'

const copy = {
  login: {
    title: 'Sign In',
    sub: 'Continue to your StyleSense profile.',
    submit: 'Sign In',
    switchText: 'Don’t have an account?',
    switchLabel: 'Create an Account',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create Account',
    sub: 'Start with what you already own.',
    submit: 'Create Your Account',
    switchText: 'Already have an account?',
    switchLabel: 'Sign In',
    switchTo: '/login',
  },
}

const fields = {
  login: [
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'Enter your email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', placeholder: 'Enter your password' },
  ],
  signup: [
    { name: 'name', label: 'Name', type: 'text', autoComplete: 'name', placeholder: 'Your name' },
    { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'Enter your email' },
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters' },
    { name: 'confirm', label: 'Confirm password', type: 'password', autoComplete: 'new-password', placeholder: 'Repeat your password' },
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

// Preview only: remembers emails (never passwords) for this tab, so a repeat signup can show the failure page.
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
      document.getElementById(`ax-${mode}-${first}`)?.focus()
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
    <section className="ax-stage" aria-label={isSignup ? 'Create account' : 'Sign in'}>
      <div className="ax-card">
        <div className="ax-art">
          <AsciiHanger />
          <p className="ax-caption" aria-hidden="true">Wear what you own.</p>
        </div>

        <div className="ax-main">
          <Link to="/" className="logo ax-logo" aria-label="StyleSense, back to home">
            Style<span>Sense</span>
          </Link>

          <div className="ax-body">
            <h1>{c.title}</h1>
            <p className="ax-sub">{c.sub}</p>

            <Button variant="outline" className="ax-google" onClick={() => setNotice('Google sign-in isn’t connected yet.')}>
              Continue with Google
            </Button>

            <p className="ax-or"><span>or</span></p>

            <form onSubmit={onSubmit} noValidate aria-label={isSignup ? 'Create account form' : 'Sign in form'}>
              {fields[mode].map((f) => {
                const id = `ax-${mode}-${f.name}`
                const err = errors[f.name]
                return (
                  <div className="ax-field" key={f.name}>
                    <label htmlFor={id}>{f.label}</label>
                    <input
                      id={id}
                      className="ax-input"
                      name={f.name}
                      type={f.type}
                      placeholder={f.placeholder}
                      autoComplete={f.autoComplete}
                      value={values[f.name]}
                      onChange={update}
                      aria-invalid={err ? 'true' : undefined}
                      aria-describedby={`${id}-err`}
                    />
                    <p id={`${id}-err`} className="ax-err">{err}</p>
                  </div>
                )
              })}

              <p className="ax-status" role="status" aria-live="polite">{notice}</p>

              <Button variant="primary" type="submit" className="ax-submit">{c.submit}</Button>
            </form>

            <p className="ax-switch">
              {c.switchText}<br />
              <Link to={c.switchTo}>{c.switchLabel}</Link>
            </p>
          </div>

          <p className="ax-legal">
            <Link to="/terms">Terms</Link>
            <span aria-hidden="true">/</span>
            <Link to="/privacy-policy">Privacy</Link>
          </p>
        </div>
      </div>
    </section>
  )
}