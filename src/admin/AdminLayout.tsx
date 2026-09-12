import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Shirt, BarChart2, Sparkles,
  Activity, FlaskConical, BookOpen, Home, Shield,
  ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react'
import PortalNavbar from '../components/portal/PortalNavbar'
import { useAuth } from '../context/useAuth'

const FF = 'Baloo Tamma 2, sans-serif'

const NAV_ITEMS = [
  { to: '/admin/dashboard',       label: 'Dashboard',           Icon: LayoutDashboard, built: true  },
  { to: '/admin/users',           label: 'Users',               Icon: Users,           built: true  },
  { to: '/admin/wardrobe',        label: 'Wardrobe Data',       Icon: Shirt,           built: true  },
  { to: '/admin/analytics',       label: 'Analytics',           Icon: BarChart2,       built: false },
  { to: '/admin/recommendations', label: 'Recommendations',     Icon: Sparkles,        built: false },
  { to: '/admin/performance',     label: 'Performance',         Icon: Activity,        built: false },
  { to: '/admin/research',        label: 'Research Analytics',  Icon: FlaskConical,    built: false },
  { to: '/admin/thesis',          label: 'Thesis Contributions',Icon: BookOpen,        built: false },
]

// Light-mode forced CSS vars (overrides any dark mode for admin only)
const LIGHT_VARS = `
  --bg-page:      #faf7f2;
  --bg-card:      #fffcf8;
  --bg-alt:       #f3eee5;
  --bg-input:     #f7f4ef;
  --bg-nav:       #faf7f2;
  --secondary:        #ffd586;
  --secondary-soft:   rgba(255,213,134,0.18);
  --secondary-strong: rgba(255,213,134,0.32);
  --accent:       #756e9e;
  --accent-hover: #5f5882;
  --text-primary:   #2b1f0e;
  --text-secondary: #756e9e;
  --text-heading:   #2b1f0e;
  --text-body:      #5c4a35;
  --text-muted:     #9c866c;
  --border:       rgba(160,120,70,0.15);
  --border-solid: #e0d0be;
  --shadow-sm:    0 2px 8px rgba(80,50,20,0.07);
  --shadow-md:    0 6px 24px rgba(80,50,20,0.10);
  --shadow-lg:    0 16px 48px rgba(80,50,20,0.13);
`

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate      = useNavigate()
  const { isAdmin }   = useAuth()
  const [collapsed,   setCollapsed]  = useState(false)
  const [mobileOpen,  setMobileOpen] = useState(false)
  const pathnameRef   = useRef<string>(pathname)

  // Guard: non-admins sent home
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  useEffect(() => { 
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname
      setMobileOpen(false)
    }
  }, [pathname])

  const sideW = collapsed ? 68 : 240

  if (!isAdmin) return null

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sidebar header */}
      <div style={{
        padding: collapsed ? '20px 0 16px' : '20px 18px 16px',
        borderBottom: '1px solid rgba(160,120,70,0.15)',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#756e9e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={16} style={{ color: '#fff' }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 13.5, color: '#2b1f0e' }}>Admin Panel</div>
            <div style={{ fontFamily: FF, fontSize: 10.5, color: '#9c866c' }}>System Evaluation &amp; Monitoring</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '12px 9px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV_ITEMS.map(({ to, label, Icon, built }) => {
          const isActive = pathname === to || (to === '/admin/dashboard' && pathname === '/admin')
          return (
            <Link key={to} to={to} title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: collapsed ? '11px 0' : '11px 13px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 10, textDecoration: 'none',
                background: isActive ? '#ffd586' : 'transparent',
                color: isActive ? '#2b1f0e' : built ? '#5c4a35' : '#b0a08a',
                fontFamily: FF, fontSize: 14, fontWeight: isActive ? 700 : 600,
                transition: 'all 0.18s',
              }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,213,134,0.22)'; (e.currentTarget as HTMLElement).style.color = '#5f5882' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = built ? '#5c4a35' : '#b0a08a' } }}
            >
              <Icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      {/* Back to Site */}
      <div style={{ padding: '12px 9px', borderTop: '1px solid rgba(160,120,70,0.15)' }}>
        <Link to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: collapsed ? '11px 0' : '11px 13px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 10, textDecoration: 'none', color: '#9c866c', fontFamily: FF, fontSize: 14, fontWeight: 600, transition: 'all 0.18s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,213,134,0.22)'; (e.currentTarget as HTMLElement).style.color = '#5f5882' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9c866c' }}
        >
          <Home size={17} style={{ flexShrink: 0 }} />
          {!collapsed && 'Back to Site'}
        </Link>
      </div>
    </div>
  )

  return (
    // Force CSS vars to light-mode values for entire admin section
    <div style={{ minHeight: '100vh', background: '#faf7f2' } as React.CSSProperties}>
      {/* Inject light vars scoped to admin */}
      <style>{`
        .admin-shell { ${LIGHT_VARS} }
        .admin-shell * { color-scheme: light; }
        @media (max-width: 900px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-btn      { display: flex !important; }
        }
      `}</style>

      <div className="admin-shell" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── SHARED MAIN NAVBAR (top) ── */}
        <PortalNavbar />

        {/* ── BELOW NAV: sidebar + content ── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Desktop sidebar */}
          <motion.aside
            className="admin-sidebar-desktop"
            animate={{ width: sideW }} transition={{ duration: 0.26, ease: 'easeInOut' }}
            style={{
              width: sideW, flexShrink: 0,
              background: '#fffcf8',
              borderRight: '1px solid rgba(160,120,70,0.15)',
              position: 'sticky', top: 'var(--nav-h)',
              height: 'calc(100vh - var(--nav-h))',
              overflowY: 'auto', overflowX: 'hidden',
              zIndex: 10,
            }}
          >
            {sidebarContent}
            {/* Collapse toggle */}
            <button onClick={() => setCollapsed(p => !p)}
              style={{
                position: 'absolute', top: '50%', right: -13, transform: 'translateY(-50%)',
                width: 26, height: 26, borderRadius: '50%',
                background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9c866c', boxShadow: '0 2px 8px rgba(80,50,20,0.07)', zIndex: 11,
              }}
            >
              {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
            </button>
          </motion.aside>

          {/* Mobile sidebar drawer */}
          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.4)' }}
                  onClick={() => setMobileOpen(false)}
                />
                <motion.aside
                  initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
                  transition={{ duration: 0.26 }}
                  style={{ position: 'fixed', top: 0, left: 0, width: 240, height: '100vh', background: '#fffcf8', borderRight: '1px solid rgba(160,120,70,0.15)', zIndex: 100, overflowY: 'auto' }}
                >
                  <button onClick={() => setMobileOpen(false)}
                    style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: '#9c866c' }}
                  ><X size={20} /></button>
                  {sidebarContent}
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {/* Mobile menu trigger (shown when sidebar hidden) */}
          <button className="admin-mobile-btn"
            onClick={() => setMobileOpen(true)}
            style={{ display: 'none', position: 'fixed', bottom: 20, left: 20, zIndex: 80, width: 48, height: 48, borderRadius: '50%', background: '#756e9e', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(117,110,158,0.35)' }}
          >
            <Menu size={22} style={{ color: '#fff' }} />
          </button>

          {/* Main content */}
          <main style={{ flex: 1, minWidth: 0, background: '#faf7f2' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
