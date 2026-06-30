import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Shirt, Compass, CalendarDays, BarChart2,
  Bookmark, Settings, HelpCircle,
  ChevronDown, Search, BookOpen, Luggage, Menu, X,
} from 'lucide-react'
import { useSettings } from '../../context'

const PRIMARY = [
  { to: '/',         label: 'Home',     Icon: Home         },
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt        },
  { to: '/discover', label: 'Discover', Icon: Compass      },
  { to: '/planner',  label: 'Planner',  Icon: CalendarDays },
]

const MORE = [
  { to: '/analytics',          label: 'Analytics',         Icon: BarChart2  },
  { to: '/cookbook',           label: 'Cookbook',          Icon: BookOpen   },
  { to: '/packing-assistant',  label: 'Packing Assistant', Icon: Luggage    },
  { to: '/saved-outfits',      label: 'Saved Outfits',     Icon: Bookmark   },
  { to: '/settings',           label: 'Settings',          Icon: Settings   },
  { to: '/help',               label: 'Help',              Icon: HelpCircle },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate      = useNavigate()
  const { isDark }    = useSettings()
  const [open, setOpen]         = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
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
    ? scrolled ? 'rgba(24,20,16,0.96)' : 'var(--bg-nav)'
    : scrolled ? 'rgba(250,247,242,0.94)' : 'var(--bg-nav)'

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        height: 'var(--nav-h)', display: 'flex', alignItems: 'center',
        padding: '0 44px', gap: 26,
        background: bg,
        borderBottom: '1px solid var(--border)',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.3s',
      }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <motion.div
            whileHover={{ rotate: -6, scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'var(--secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2b1f0e', fontFamily: 'Bagel Fat One, cursive', fontSize: 21,
            }}
          >S</motion.div>
          <span style={{
            fontFamily: 'Baloo Tamma 2, sans-serif', fontWeight: 800, fontSize: 23,
            color: 'var(--text-heading)', letterSpacing: -0.3,
          }} className="ss-logo-text">
            Style<span style={{ color: 'var(--accent)' }}>Sense</span>
          </span>
        </Link>

        {/* Search — hidden on small screens */}
        <div className="ss-nav-search" style={{ flex: 1, maxWidth: 380, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search clothes, outfits, styles…"
            style={{
              width: '100%', height: 44,
              border: '1.5px solid var(--border)',
              borderRadius: 26, padding: '0 18px 0 44px',
              fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 15,
              color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Desktop links */}
        <div className="ss-nav-links" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 30 }}>
          {PRIMARY.map(({ to, label, Icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 15.5, fontWeight: 600,
                  textDecoration: 'none',
                  color: active ? 'var(--accent)' : 'var(--text-body)',
                  paddingBottom: 3,
                  borderBottom: active ? '2.5px solid var(--secondary)' : '2.5px solid transparent',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? 'var(--accent)' : 'var(--text-body)' }}
              >
                <Icon size={17} />{label}
              </Link>
            )
          })}

          {/* More */}
          <div ref={ref} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 15.5, fontWeight: 600,
                color: 'var(--text-body)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-body)' }}
            >
              More
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
                <ChevronDown size={15} />
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
                    position: 'absolute', top: 'calc(100% + 16px)', right: 0,
                    background: 'var(--bg-card)', borderRadius: 16,
                    padding: '10px 0', minWidth: 210, zIndex: 300,
                    border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  {MORE.map(({ to, label, Icon }) => (
                    <Link key={to} to={to} onClick={() => setOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 13,
                        padding: '11px 20px', textDecoration: 'none',
                        color: 'var(--text-body)',
                        fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 14.5, fontWeight: 500,
                        transition: 'all 0.14s',
                      }}
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'var(--secondary-soft)'
                        el.style.color = 'var(--accent)'
                        el.style.paddingLeft = '24px'
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement
                        el.style.background = 'transparent'
                        el.style.color = 'var(--text-body)'
                        el.style.paddingLeft = '20px'
                      }}
                    >
                      <Icon size={16} />{label}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sign In */}
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/login')}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none', borderRadius: 30, padding: '11px 26px', cursor: 'pointer',
              fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 15, fontWeight: 700,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
          >Sign In</motion.button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="ss-mobile-toggle"
          onClick={() => setMobileOpen(p => !p)}
          style={{
            display: 'none', marginLeft: 'auto',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-heading)', padding: 6,
          }}
        >
          {mobileOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26 }}
            style={{
              overflow: 'hidden',
              background: 'var(--bg-nav)',
              borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 'var(--nav-h)', zIndex: 199,
            }}
          >
            <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  placeholder="Search clothes, outfits, styles…"
                  style={{
                    width: '100%', height: 44, border: '1.5px solid var(--border)',
                    borderRadius: 14, padding: '0 16px 0 40px',
                    fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 14.5,
                    color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none',
                  }}
                />
              </div>
              {[...PRIMARY, ...MORE].map(({ to, label, Icon }) => {
                const active = pathname === to
                return (
                  <Link key={to} to={to} onClick={() => setMobileOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 13,
                      padding: '13px 14px', borderRadius: 12,
                      textDecoration: 'none',
                      background: active ? 'var(--secondary-soft)' : 'transparent',
                      color: active ? 'var(--accent)' : 'var(--text-body)',
                      fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 16, fontWeight: 600,
                    }}
                  >
                    <Icon size={19} />{label}
                  </Link>
                )
              })}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setMobileOpen(false)
                  navigate('/login')
                }}
                style={{
                  marginTop: 10, background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 30, padding: '13px 0', cursor: 'pointer',
                  fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 16, fontWeight: 700,
                }}
              >Sign In</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 1023px) {
          .ss-nav-search { display: none !important; }
          .ss-nav-links { display: none !important; }
          .ss-mobile-toggle { display: flex !important; align-items: center; justify-content: center; }
        }
        @media (max-width: 480px) {
          .ss-logo-text { display: none; }
        }
      `}</style>
    </>
  )
}