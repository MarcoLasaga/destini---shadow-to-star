import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Shirt, Compass, CalendarDays, BarChart2,
  Bookmark, Settings, HelpCircle,
  ChevronDown, Search, BookOpen, Luggage,
} from 'lucide-react'
import { useSettings } from '../../context/useSettings'

const PRIMARY = [
  { to: '/',         label: 'Home',     Icon: Home        },
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt       },
  { to: '/discover', label: 'Discover', Icon: Compass     },
  { to: '/planner',  label: 'Planner',  Icon: CalendarDays },
]

const MORE = [
  { to: '/analytics',         label: 'Analytics',         Icon: BarChart2  },
  { to: '/cookbook',          label: 'Cookbook',          Icon: BookOpen   },
  { to: '/packing-assistant', label: 'Packing Assistant', Icon: Luggage    },
  { to: '/saved-outfits',     label: 'Saved Outfits',     Icon: Bookmark   },
  { to: '/settings',          label: 'Settings',          Icon: Settings   },
  { to: '/help',              label: 'Help',              Icon: HelpCircle },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { isDark }   = useSettings()
  const [open, setOpen]         = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const bg = isDark
    ? scrolled ? 'rgba(24,19,16,0.96)' : 'var(--bg-nav)'
    : scrolled ? 'rgba(250,247,242,0.92)' : 'var(--bg-nav)'

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 200,
      height: 58, display: 'flex', alignItems: 'center',
      padding: '0 36px', gap: 20,
      background: bg,
      borderBottom: '1px solid var(--border)',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
      boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      transition: 'all 0.3s',
    }}>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        <motion.div
          whileHover={{ rotate: -6, scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#2b1f0e', fontFamily: 'Bagel Fat One, cursive', fontSize: 17,
          }}
        >S</motion.div>
        <span style={{ fontFamily: 'Baloo Tamma 2, sans-serif', fontWeight: 800, fontSize: 19, color: 'var(--text-heading)', letterSpacing: -0.3 }}>
          Style<span style={{ color: 'var(--text-secondary)' }}>Sense</span>
        </span>
      </Link>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          type="text" placeholder="Search clothes, outfits, styles…"
          style={{
            width: '100%', height: 36,
            border: '1.5px solid var(--border)', borderRadius: 24,
            padding: '0 16px 0 38px',
            fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 13.5,
            color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Links */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
        {PRIMARY.map(({ to, label, Icon }) => {
          const active = pathname === to
          return (
            <Link key={to} to={to}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontFamily: 'Baloo Tamma 2, sans-serif',
                fontSize: 14, fontWeight: 600, textDecoration: 'none',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                paddingBottom: 2,
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
            >
              <Icon size={14} />{label}
            </Link>
          )
        })}

        {/* More dropdown */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button onClick={() => setOpen(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none',
              border: 'none', cursor: 'pointer',
              fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 14, fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            More
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronDown size={13} />
            </motion.span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0,  scale: 1    }}
                exit={{   opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.2, ease: [0.34, 1.2, 0.64, 1] }}
                style={{
                  position: 'absolute', top: 'calc(100% + 14px)', right: 0,
                  background: 'var(--bg-card)', borderRadius: 14, padding: '8px 0',
                  minWidth: 200, zIndex: 300,
                  border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                }}
              >
                {MORE.map(({ to, label, Icon }) => (
                  <Link key={to} to={to} onClick={() => setOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 11,
                      padding: '9px 18px', textDecoration: 'none',
                      color: 'var(--text-body)',
                      fontFamily: 'Baloo Tamma 2, sans-serif',
                      fontSize: 13.5, fontWeight: 500, transition: 'all 0.14s',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = isDark ? 'rgba(255,213,134,0.08)' : 'rgba(255,213,134,0.2)'
                      el.style.color = 'var(--accent-hover)'
                      el.style.paddingLeft = '22px'
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement
                      el.style.background = 'transparent'
                      el.style.color = 'var(--text-body)'
                      el.style.paddingLeft = '18px'
                    }}
                  >
                    <Icon size={14} />{label}
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sign In */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
          style={{
            background: isDark ? 'var(--accent)' : '#2b1f0e',
            color: isDark ? '#2b1f0e' : '#fff',
            border: 'none', borderRadius: 30, padding: '9px 22px', cursor: 'pointer',
            fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 14, fontWeight: 700,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isDark ? 'var(--accent)' : '#2b1f0e'
            e.currentTarget.style.color = isDark ? '#2b1f0e' : '#fff'
          }}
        >Sign In</motion.button>
      </div>
    </nav>
  )
}