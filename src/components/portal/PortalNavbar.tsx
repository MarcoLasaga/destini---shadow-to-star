import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, LogOut, Shield } from 'lucide-react'
import { useAuth } from '../../context/useAuth'

export default function PortalNavbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isLoggedIn, isAdmin, logout, user } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  return (
    <header className="portal-header">
      <Link to="/" className="portal-brand" aria-label="StyleSense portal home">
        <span className="portal-brand-mark">S</span>
        <span>Style<span className="portal-brand-accent">Sense</span></span>
      </Link>

      <nav className="portal-nav" aria-label="Portal navigation">
        <Link className={pathname === '/' ? 'portal-nav-link is-active' : 'portal-nav-link'} to="/">Overview</Link>
        {isAdmin && (
          <Link className={pathname.startsWith('/admin') ? 'portal-nav-link is-active' : 'portal-nav-link'} to="/admin">
            Operations
          </Link>
        )}
        <Link className="portal-nav-link" to="/privacy-policy">Privacy</Link>
        <Link className="portal-nav-link" to="/terms-of-service">Terms</Link>
      </nav>

      <div className="portal-actions">
        {isLoggedIn ? (
          <>
            {isAdmin && <span className="portal-role"><Shield size={14} /> Admin</span>}
            <span className="portal-user">{user?.name}</span>
            <button className="portal-button portal-button-quiet" onClick={handleLogout} type="button">
              <LogOut size={15} /> Sign out
            </button>
          </>
        ) : (
          <>
            <Link className="portal-signin" to="/login">Sign in</Link>
            <Link className="portal-button portal-button-dark" to="/signup">Create account <ArrowUpRight size={15} /></Link>
          </>
        )}
      </div>
    </header>
  )
}
