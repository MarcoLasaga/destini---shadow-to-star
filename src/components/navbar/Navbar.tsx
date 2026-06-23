import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Shirt, Compass, CalendarDays, BarChart2,
  Clock, Users, Bookmark, AlertCircle, Settings,
  HelpCircle, ChevronDown, Search,
} from 'lucide-react'

const PRIMARY = [
  { to: '/',         label: 'Home',     Icon: Home        },
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt       },
  { to: '/discover', label: 'Discover', Icon: Compass     },
  { to: '/planner',  label: 'Planner',  Icon: CalendarDays},
]

const MORE = [
  { to: '/analytics',      label: 'Analytics',      Icon: BarChart2   },
  { to: '/calendar',       label: 'Calendar',       Icon: CalendarDays},
  { to: '/outfit-history', label: 'Outfit History', Icon: Clock       },
  { to: '/community',      label: 'Community',      Icon: Users       },
  { to: '/saved-outfits',  label: 'Saved Outfits',  Icon: Bookmark    },
  { to: '/wardrobe-gaps',  label: 'Wardrobe Gaps',  Icon: AlertCircle },
  { to: '/settings',       label: 'Settings',       Icon: Settings    },
  { to: '/help',           label: 'Help',           Icon: HelpCircle  },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const [open, setOpen]       = useState(false)
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

  const linkStyle = (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: 'Baloo Tamma 2, sans-serif',
    fontSize: 14, fontWeight: 600,
    color: active ? '#2b1f0e' : '#5c4a35',
    textDecoration: 'none',
    paddingBottom: 2,
    borderBottom: active ? '2px solid #ffd586' : '2px solid transparent',
    transition: 'color 0.18s, border-color 0.18s',
  })

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      height: 58, display: 'flex', alignItems: 'center',
      padding: '0 36px', gap: 20,
      background: scrolled ? 'rgba(250,247,242,0.92)' : '#faf7f2',
      borderBottom: '1px solid rgba(160,120,70,0.15)',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      boxShadow: scrolled ? '0 2px 8px rgba(80,50,20,0.07)' : 'none',
      transition: 'all 0.3s',
    }}>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
        <motion.div
          whileHover={{ rotate: -6, scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          style={{
            width: 34, height: 34, borderRadius: 8,
            background: '#ffd586', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: '#2b1f0e', fontFamily: 'Bagel Fat One, cursive', fontSize: 17,
          }}
        >S</motion.div>
        <span style={{ fontFamily: 'Baloo Tamma 2, sans-serif', fontWeight: 800, fontSize: 19, color: '#2b1f0e', letterSpacing: -0.3 }}>
          Style<span style={{ color: '#756e9e' }}>Sense</span>
        </span>
      </Link>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 320, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9c866c', pointerEvents: 'none' }} />
        <input
          placeholder="Search clothes, outfits, styles…"
          style={{
            width: '100%', height: 36,
            border: '1.5px solid rgba(160,120,70,0.18)',
            borderRadius: 24, padding: '0 16px 0 38px',
            fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 13.5,
            color: '#5c4a35', background: '#fffcf8', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.25)' }}
          onBlur={e  => { e.target.style.borderColor = 'rgba(160,120,70,0.18)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Links */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
        {PRIMARY.map(({ to, label, Icon }) => (
          <Link key={to} to={to} style={linkStyle(pathname === to)}
            onMouseEnter={e => (e.currentTarget.style.color = '#FF8C00')}
            onMouseLeave={e => (e.currentTarget.style.color = pathname === to ? '#2b1f0e' : '#5c4a35')}
          >
            <Icon size={14} />{label}
          </Link>
        ))}

        {/* More */}
        <div ref={ref} style={{ position: 'relative' }}>
          <button onClick={() => setOpen(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'Baloo Tamma 2, sans-serif',
              fontSize: 14, fontWeight: 600, color: '#5c4a35',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#FF8C00')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#5c4a35')}
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
                  background: '#fffcf8', borderRadius: 14, padding: '8px 0',
                  minWidth: 186, zIndex: 300,
                  border: '1px solid rgba(160,120,70,0.15)',
                  boxShadow: '0 16px 48px rgba(80,50,20,0.13)',
                }}
              >
                {MORE.map(({ to, label, Icon }) => (
                  <Link key={to} to={to} onClick={() => setOpen(false)}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 18px', textDecoration: 'none', color: '#4a3828', fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 13.5, fontWeight: 500, transition: 'all 0.14s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,213,134,0.3)'; e.currentTarget.style.color = '#FF8C00'; e.currentTarget.style.paddingLeft = '22px' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#4a3828'; e.currentTarget.style.paddingLeft = '18px' }}
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
            background: '#2b1f0e', color: '#fff', border: 'none',
            borderRadius: 30, padding: '9px 22px', cursor: 'pointer',
            fontFamily: 'Baloo Tamma 2, sans-serif', fontSize: 14, fontWeight: 700,
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#4a3828')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#2b1f0e')}
        >Sign In</motion.button>
      </div>
    </nav>
  )
}