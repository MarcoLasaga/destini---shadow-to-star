import Button from './Button.jsx'
import NavItem from './NavItem.jsx'

export default function MobileMenu({ id, open, links, onClose }) {
  return (
    <div id={id} className={`mobile-menu ${open ? 'is-open' : ''}`} inert={!open}>
      <ul>
        {links.map((link) => (
          <li key={link.label}>
            <NavItem link={link} onClick={onClose} />
          </li>
        ))}
      </ul>
      <div className="mobile-menu-actions">
        <Button variant="outline" to="/login" onClick={onClose}>Sign In</Button>
        <Button variant="primary" to="/signup" className="nav-cta" onClick={onClose}>Get Started</Button>
      </div>
    </div>
  )
}