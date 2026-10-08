import { useRef, useState } from 'react'
import Button from '../components/Button.jsx'
import Notice from '../components/Notice.jsx'

const topics = ['General feedback', 'Report a bug', 'Suggest a feature', 'Account issue', 'Other']
const MAX = 5 * 1024 * 1024
const EMAIL = /^\S+@\S+\.\S+$/
const blank = { name: '', email: '', subject: '', message: '' }

function check(v, file) {
  const e = {}
  if (!v.name.trim()) e.name = 'Please enter your name.'
  if (!v.email.trim()) e.email = 'Please enter your email.'
  else if (!EMAIL.test(v.email.trim())) e.email = 'Please enter a valid email address.'
  if (!v.subject.trim()) e.subject = 'Please add a subject.'
  if (v.message.trim().length < 10) e.message = 'Please write a little more, at least 10 characters.'
  if (file && !file.type.startsWith('image/')) e.file = 'Please attach an image (PNG, JPG or WebP).'
  else if (file && file.size > MAX) e.file = 'That image is over 5 MB.'
  return e
}

export default function Contact() {
  const [topic, setTopic] = useState(topics[0])
  const [values, setValues] = useState(blank)
  const [file, setFile] = useState(null)
  const [errors, setErrors] = useState({})
  const [done, setDone] = useState(false)
  const fileRef = useRef(null)

  const update = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((er) => ({ ...er, [name]: undefined }))
  }

  const pickFile = (e) => {
    setFile(e.target.files?.[0] ?? null)
    setErrors((er) => ({ ...er, file: undefined }))
  }

  const clearFile = () => {
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onSubmit = (e) => {
    e.preventDefault()
    const problems = check(values, file)
    setErrors(problems)
    const first = Object.keys(problems)[0]
    if (first) {
      document.getElementById(`cf-${first}`)?.focus()
      return
    }
    setDone(true)
  }

  const again = () => {
    setValues(blank)
    setTopic(topics[0])
    clearFile()
    setErrors({})
    setDone(false)
  }

  const field = (name, label, props = {}) => (
    <div className="cf-field">
      <label htmlFor={`cf-${name}`}>{label}</label>
      {props.area ? (
        <textarea id={`cf-${name}`} name={name} className="cf-input" rows={6} value={values[name]} onChange={update}
          aria-invalid={errors[name] ? 'true' : undefined} aria-describedby={`cf-${name}-err`} />
      ) : (
        <input id={`cf-${name}`} name={name} className="cf-input" type={props.type || 'text'} autoComplete={props.auto}
          value={values[name]} onChange={update}
          aria-invalid={errors[name] ? 'true' : undefined} aria-describedby={`cf-${name}-err`} />
      )}
      <p id={`cf-${name}-err`} className="fld-err">{errors[name]}</p>
    </div>
  )

  return (
    <>
      <section className="feat-hero">
        <div className="wrap">
          <div className="feat-hero-inner">
            <p className="eyebrow">Contact</p>
            <h1>Tell us what you think.</h1>
            <p className="lead">Feedback, a bug, an idea for a feature. Everything helps shape StyleSense.</p>
          </div>
        </div>
      </section>

      <section className="cf-section">
        <div className="wrap cf-grid">
          <div className="cf-aside">
            <h2>Reporting a bug?</h2>
            <p>Say what you were doing, what you expected and what happened instead. A screenshot helps a lot.</p>
            <p>Prefer email? Write to <a href="mailto:hello@stylesense.app">hello@stylesense.app</a>.</p>
          </div>

          {done ? (
            <div className="cf-done" role="status">
              <h2>Thanks for reaching out.</h2>
              <p className="lead">
                Your feedback has been prepared successfully. This form will be connected to support services once the backend is enabled.
              </p>
              <Notice kind="info">Nothing has been sent yet, and no support ticket was created.</Notice>
              <div className="hero-buttons">
                <Button variant="primary" onClick={again}>Send another</Button>
                <Button variant="outline" to="/">Back to Home</Button>
              </div>
            </div>
          ) : (
            <form className="cf-form" onSubmit={onSubmit} noValidate aria-label="Contact form">
              <fieldset className="cf-topics-wrap">
                <legend className="cf-legend">What can we help with?</legend>
                <div className="cf-topics">
                  {topics.map((t) => (
                    <label key={t} className="cf-topic">
                      <input type="radio" name="topic" value={t} checked={topic === t} onChange={() => setTopic(t)} />
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="cf-fields">
                <div className="cf-two">
                  {field('name', 'Name', { auto: 'name' })}
                  {field('email', 'Email', { type: 'email', auto: 'email' })}
                </div>
                {field('subject', 'Subject')}
                {field('message', 'Message', { area: true })}

                <div className="cf-field">
                  <label className="cf-file">
                    <input id="cf-file" ref={fileRef} type="file" accept="image/*" onChange={pickFile}
                      aria-describedby="cf-file-err" />
                    <span>{file ? 'Change screenshot' : 'Attach a screenshot (optional)'}</span>
                  </label>
                  {file && (
                    <p className="cf-filename">
                      {file.name}{' '}
                      <button type="button" className="cf-remove" onClick={clearFile}>Remove</button>
                    </p>
                  )}
                  <p id="cf-file-err" className="fld-err">{errors.file}</p>
                </div>
              </div>

              <Button variant="primary" type="submit" className="cf-submit">Send Feedback</Button>
            </form>
          )}
        </div>
      </section>
    </>
  )
}