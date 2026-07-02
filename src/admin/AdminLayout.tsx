import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Users, Shirt, BarChart2, Sparkles,
  Activity, FlaskConical, BookOpen, Home, Shield,
  ChevronLeft, ChevronRight, Menu, X,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const NAV_ITEMS = [
  { to: '/admin/dashboard',           label: 'Dashboard',          Icon: LayoutDashboard, active: true  },
  { to: '/admin/users',               label: 'Users',              Icon: Users,           active: false },
  { to: '/admin/wardrobe',            label: 'Wardrobe Data',      Icon: Shirt,           active: false },
  { to: '/admin/analytics',           label: 'Analytics',          Icon: BarChart2,       active: false },
  { to: '/admin/recommendations',     label: 'Recommendations',    Icon: Sparkles,        active: false },
  { to: '/admin/performance',         label: 'Performance',        Icon: Activity,        active: false },
  { to: '/admin/research',            label: 'Research Analytics', Icon: FlaskConical,    active: false },
  { to: '/admin/thesis',              label: 'Thesis Contributions',Icon: BookOpen,       active: false },
]

export default function AdminLayout() {
  const { pathname } = useLocation()
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)

  const sideW = collapsed ? 68 : 240

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo area */}
      <div style={{ padding: collapsed ? '22px 0 18px' : '22px 20px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Shield size={18} style={{ color: '#fff' }} />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 14.5, color: 'var(--text-heading)' }}>Admin Panel</div>
            <div style={{ fontFamily: FF, fontSize: 11, color: 'var(--text-muted)' }}>System Evaluation &amp; Monitoring</div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const isActive = pathname === to || (to === '/admin/dashboard' && pathname === '/admin')
          return (
            <Link key={to} to={to}
              title={collapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '11px 0' : '11px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 11, textDecoration: 'none',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-body)',
                fontFamily: FF, fontSize: 14, fontWeight: 600,
                transition: 'all 0.18s',
                opacity: (!NAV_ITEMS.find(n => n.to === to)?.active && !isActive) ? 0.55 : 1,
              }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-body)' } }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && label}
            </Link>
          )
        })}
      </nav>

      {/* Back to site */}
      <div style={{ padding: '14px 10px', borderTop: '1px solid var(--border)' }}>
        <Link to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: collapsed ? '11px 0' : '11px 14px', justifyContent: collapsed ? 'center' : 'flex-start', borderRadius: 11, textDecoration: 'none', color: 'var(--text-muted)', fontFamily: FF, fontSize: 14, fontWeight: 600, transition: 'all 0.18s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <Home size={18} style={{ flexShrink: 0 }} />
          {!collapsed && 'Back to Site'}
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)' }}>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: sideW }} transition={{ duration: 0.26, ease: 'easeInOut' }}
        className="admin-sidebar-desktop"
        style={{
          width: sideW, flexShrink: 0, background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)', position: 'sticky', top: 0,
          height: '100vh', overflowY: 'auto', overflowX: 'hidden',
          display: 'flex', flexDirection: 'column', zIndex: 10,
        }}
      >
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(p => !p)}
          style={{
            position: 'absolute', top: '50%', right: -14, transform: 'translateY(-50%)',
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)', zIndex: 11,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </motion.aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.45)' }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ duration: 0.26 }}
              style={{ position: 'fixed', top: 0, left: 0, width: 240, height: '100vh', background: 'var(--bg-card)', borderRight: '1px solid var(--border)', zIndex: 100, overflowY: 'auto' }}
            >
              <button onClick={() => setMobileOpen(false)}
                style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              ><X size={20} /></button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile topbar */}
        <div className="admin-mobile-header" style={{
          display: 'none', alignItems: 'center', gap: 14, padding: '14px 20px',
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-heading)', padding: 4 }}
          ><Menu size={24} /></button>
          <span style={{ fontFamily: FH, fontSize: 20, color: 'var(--text-heading)' }}>Admin Panel</span>
        </div>

        {/* Page content */}
        <Outlet />
      </div>

      <style>{`
        @media (max-width: 900px) {
          .admin-sidebar-desktop { display: none !important; }
          .admin-mobile-header   { display: flex !important; }
        }
      `}</style>
    </div>
  )
}