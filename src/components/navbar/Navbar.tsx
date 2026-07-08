import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Shirt, Compass, CalendarDays, BarChart2,
  Bookmark, Settings, HelpCircle,
  ChevronDown, Search, BookOpen, Luggage, Menu, X,
  Bell, LogOut, Check, Shield,
} from 'lucide-react'
import { useSettings } from '../../context/useSettings'
import { useAuth } from '../../context/useAuth'
import { resolveAvatarUrl } from '../../utils/profileAvatar'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const PRIMARY = [
  { to: '/',         label: 'Home',     Icon: Home         },
  { to: '/wardrobe', label: 'Wardrobe', Icon: Shirt        },
  { to: '/discover', label: 'Discover', Icon: Compass      },
  { to: '/planner',  label: 'Planner',  Icon: CalendarDays },
]

const MORE_USER = [
  { to: '/analytics',         label: 'Analytics',         Icon: BarChart2  },
  { to: '/cookbook',          label: 'Cookbook',          Icon: BookOpen   },
  { to: '/packing-assistant', label: 'Packing Assistant', Icon: Luggage    },
  { to: '/saved-outfits',     label: 'Saved Outfits',     Icon: Bookmark   },
  { to: '/settings',          label: 'Settings',          Icon: Settings   },
  { to: '/help',              label: 'Help',              Icon: HelpCircle },
]

const MORE_ADMIN_EXTRA = [
  { to: '/admin/dashboard', label: 'Admin Panel', Icon: Shield },
]

const MOCK_NOTIFICATIONS = [
  { id: '1', text: 'Your weekly outfit plan is ready!',         time: '2m ago',    read: false },
  { id: '2', text: 'New community outfits matching your style.', time: '1h ago',   read: false },
  { id: '3', text: 'Weather alert: Rain expected tomorrow.',     time: '3h ago',   read: true  },
  { id: '4', text: "You've worn 5 outfits this week!",           time: 'Yesterday', read: true  },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate      = useNavigate()
  const { isDark }    = useSettings()
  const { isLoggedIn, user, isAdmin, logout } = useAuth()

  const [open,          setOpen]          = useState(false)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [scrolled,      setScrolled]      = useState(false)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS)
  const [logoutOpen,    setLogoutOpen]    = useState(false)

  const moreRef  = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const pathnameRef = useRef<string>(pathname)

  const unread    = notifications.filter(n => !n.read).length
  const moreLinks = isAdmin ? [...MORE_USER, ...MORE_ADMIN_EXTRA] : MORE_USER

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (moreRef.current  && !moreRef.current.contains(e.target as Node))  setOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  useEffect(() => { 
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname
      setMobileOpen(false)
    }
  }, [pathname])

  function markAllRead() { setNotifications(prev => prev.map(n => ({ ...n, read: true }))) }
  function handleLogout() { setLogoutOpen(false); logout(); navigate('/') }

  const bg = isDark
    ? scrolled ? 'rgba(24,20,16,0.96)' : 'var(--bg-nav)'
    : scrolled ? 'rgba(250,247,242,0.94)' : 'var(--bg-nav)'

  const avatarSrc = resolveAvatarUrl(user?.avatarUrl)

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        height: 'var(--nav-h)', display: 'flex', alignItems: 'center',
        padding: '0 36px', gap: 22,
        background: bg,
        borderBottom: '1px solid var(--border)',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'all 0.3s',
      }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
          <motion.div whileHover={{ rotate: -6, scale: 1.08 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2b1f0e', fontFamily: FH, fontSize: 21 }}
          >S</motion.div>
          <span className="ss-logo-text" style={{ fontFamily: FF, fontWeight: 800, fontSize: 23, color: 'var(--text-heading)', letterSpacing: -0.3 }}>
            Style<span style={{ color: 'var(--accent)' }}>Sense</span>
          </span>
        </Link>

        {/* Search */}
        <div className="ss-nav-search" style={{ flex: 1, maxWidth: 380, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Search clothes, outfits, styles…"
            style={{ width: '100%', height: 44, border: '1.5px solid var(--border)', borderRadius: 26, padding: '0 18px 0 44px', fontFamily: FF, fontSize: 15, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Desktop links */}
        <div className="ss-nav-links" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 28 }}>
          {PRIMARY.map(({ to, label, Icon }) => {
            const active = pathname === to
            return (
              <Link key={to} to={to}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 15.5, fontWeight: 600, textDecoration: 'none', color: active ? 'var(--accent)' : 'var(--text-body)', paddingBottom: 3, borderBottom: active ? '2.5px solid var(--secondary)' : '2.5px solid transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? 'var(--accent)' : 'var(--text-body)' }}
              ><Icon size={17} />{label}</Link>
            )
          })}

          {/* More */}
          <div ref={moreRef} style={{ position: 'relative' }}>
            <button onClick={() => setOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: FF, fontSize: 15.5, fontWeight: 600, color: 'var(--text-body)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-body)' }}
            >
              More
              <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}><ChevronDown size={15} /></motion.span>
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.34, 1.2, 0.64, 1] }}
                  style={{ position: 'absolute', top: 'calc(100% + 16px)', right: 0, background: 'var(--bg-card)', borderRadius: 16, padding: '10px 0', minWidth: 210, zIndex: 300, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                >
                  {moreLinks.map(({ to, label, Icon }, i) => {
                    const isAdminLink = to.startsWith('/admin')
                    return (
                      <div key={to}>
                        {/* Divider before Admin Panel */}
                        {isAdminLink && i > 0 && (
                          <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
                        )}
                        <Link to={to} onClick={() => setOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 20px', textDecoration: 'none', color: isAdminLink ? 'var(--accent)' : 'var(--text-body)', fontFamily: FF, fontSize: 14.5, fontWeight: isAdminLink ? 700 : 500, transition: 'all 0.14s' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--secondary-soft)'; el.style.color = 'var(--accent)'; el.style.paddingLeft = '24px' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = isAdminLink ? 'var(--accent)' : 'var(--text-body)'; el.style.paddingLeft = '20px' }}
                        >
                          <Icon size={16} />{label}
                        </Link>
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auth section */}
          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

              {/* Bell */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <button onClick={() => setNotifOpen(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-body)', position: 'relative', padding: 4, display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-body)' }}
                >
                  <Bell size={22} />
                  {unread > 0 && (
                    <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, background: '#e03a3a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF, fontSize: 9, fontWeight: 800, color: '#fff' }}>
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {notifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.2, ease: [0.34, 1.2, 0.64, 1] }}
                      style={{ position: 'absolute', top: 'calc(100% + 16px)', right: 0, background: 'var(--bg-card)', borderRadius: 16, padding: '16px 0 8px', width: 320, zIndex: 300, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: 'var(--text-heading)' }}>Notifications</span>
                        {unread > 0 && (
                          <button onClick={markAllRead} style={{ fontFamily: FF, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>
                        )}
                      </div>
                      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                        {notifications.map(n => (
                          <div key={n.id}
                            style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', background: n.read ? 'transparent' : 'var(--secondary-soft)', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-alt)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'var(--secondary-soft)' }}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                            <div style={{ flex: 1 }}>
                              <p style={{ fontFamily: FF, fontSize: 13.5, fontWeight: n.read ? 500 : 700, color: 'var(--text-body)', lineHeight: 1.45, marginBottom: 3 }}>{n.text}</p>
                              <span style={{ fontFamily: FF, fontSize: 11.5, color: 'var(--text-muted)' }}>{n.time}</span>
                            </div>
                            {n.read && <Check size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Admin badge (shown when admin) */}
              {isAdmin && (
                <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Shield size={14} /> Admin
                </span>
              )}

              {/* Avatar */}
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                onClick={() => navigate('/account')}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-alt)', border: '1.5px solid var(--border-solid)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}
              >
                <img src={avatarSrc} alt={user?.name ?? 'Profile'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </motion.button>

              {/* Logout */}
              <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                onClick={() => setLogoutOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e03a3a' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                <LogOut size={22} />
              </motion.button>
            </div>
          ) : (
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/login')}
              style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 30, padding: '11px 26px', cursor: 'pointer', fontFamily: FF, fontSize: 15, fontWeight: 700 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
            >Sign In</motion.button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="ss-mobile-toggle" onClick={() => setMobileOpen(p => !p)}
          style={{ display: 'none', marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-heading)', padding: 6 }}
        >
          {mobileOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26 }}
            style={{ overflow: 'hidden', background: 'var(--bg-nav)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 'var(--nav-h)', zIndex: 199 }}
          >
            <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[...PRIMARY, ...moreLinks].map(({ to, label, Icon }) => {
                const active = pathname === to
                const isAdminLink = to.startsWith('/admin')
                return (
                  <Link key={to} to={to}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 12, textDecoration: 'none', background: active ? 'var(--secondary-soft)' : 'transparent', color: isAdminLink ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--text-body)', fontFamily: FF, fontSize: 16, fontWeight: 600 }}
                  ><Icon size={19} />{label}</Link>
                )
              })}
              {isLoggedIn ? (
                <button onClick={() => setLogoutOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#e03a3a', fontFamily: FF, fontSize: 16, fontWeight: 600, marginTop: 8 }}
                ><LogOut size={19} /> Log Out</button>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => navigate('/login')}
                  style={{ marginTop: 10, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 30, padding: '13px 0', cursor: 'pointer', fontFamily: FF, fontSize: 16, fontWeight: 700 }}
                >Sign In</motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logout confirmation */}
      <AnimatePresence>
        {logoutOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setLogoutOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.24, ease: [0.34, 1.1, 0.64, 1] }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '32px 30px 26px', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}
            >
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(224,58,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                <LogOut size={26} style={{ color: '#e03a3a' }} />
              </div>
              <h2 style={{ fontFamily: FH, fontSize: 22, color: 'var(--text-heading)', marginBottom: 9 }}>Log Out?</h2>
              <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 26, lineHeight: 1.55 }}>Are you sure you want to log out of StyleSense?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setLogoutOpen(false)}
                  style={{ flex: 1, fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '11px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
                >Cancel</button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleLogout}
                  style={{ flex: 1, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: '#e03a3a', border: 'none', borderRadius: 11, padding: '11px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#c02020' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#e03a3a' }}
                >Log Out</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 1023px) {
          .ss-nav-search  { display: none !important; }
          .ss-nav-links   { display: none !important; }
          .ss-mobile-toggle { display: flex !important; align-items: center; justify-content: center; }
        }
        @media (max-width: 480px) { .ss-logo-text { display: none; } }
      `}</style>
    </>
  )
}