import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import NavItem from '../components/NavItem.jsx'
import { navLinks } from '../data/navLinks.js'

export default function NotFound({ theme, onToggleTheme }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <div className="nf-scene">
      <header className="nf-top wrap rv" style={{ '--d': '0s' }}>
        <Link to="/" className="logo" aria-label="StyleSense home">
          Style<span>Sense</span>
        </Link>
        <div className="nf-top-actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            type="button"
            className="nf-burger"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="nf-menu"
            aria-label="Open menu"
          >
            <span /><span />
          </button>
        </div>
      </header>

      <div id="nf-menu" className={`nf-menu${open ? ' is-open' : ''}`} hidden={!open}>
        <div className="nf-menu-top wrap">
          <Link to="/" className="logo" onClick={() => setOpen(false)}>Style<span>Sense</span></Link>
          <button type="button" className="nf-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul className="wrap">
          {navLinks.map((link) => (
            <li key={link.label}>
              <NavItem link={link} onClick={() => setOpen(false)} />
            </li>
          ))}
        </ul>
      </div>

      <section className="nf-body wrap" aria-labelledby="nf-title">
        <h1 id="nf-title">
          <span className="nf-code rv" style={{ '--d': '0.15s' }}>404</span>
          <span className="nf-title rv" style={{ '--d': '0.35s' }}>Page not found</span>
        </h1>
        <p className="nf-msg rv" style={{ '--d': '0.55s' }}>
          The page you’re looking for doesn’t exist or may have been moved.
        </p>
        <Link to="/" className="nf-back rv" style={{ '--d': '0.75s' }}>
          Back to homepage <span aria-hidden="true">↗</span>
        </Link>
      </section>

      {/* Atmospheric visual. To use a real photo later, drop an <img> inside
          .nf-visual (src="/images/404-visual.jpg") and remove .nf-orb. */}
      <div className="nf-visual rv-slow" aria-hidden="true">
        <div className="nf-orb" />
      </div>
    </div>
  )
}