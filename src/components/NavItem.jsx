import { Link, NavLink } from 'react-router-dom'

export const navLinks = [
  { label: 'Home', to: '/', end: true },
  { label: 'Features', to: '/features' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'About', to: '/about' },
  { label: 'Download', to: '/download' },
]

export default function NavItem({ link, onClick }) {
  if (link.hash) {
    return <Link to={link.to} onClick={onClick}>{link.label}</Link>
  }
  return (
    <NavLink to={link.to} end={link.end} onClick={onClick}>
      {link.label}
    </NavLink>
  )
}