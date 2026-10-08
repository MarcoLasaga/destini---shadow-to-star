import AuthLinks from './AuthLinks.jsx'
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
      <AuthLinks layout="menu" onNavigate={onClose} />
    </div>
  )
}