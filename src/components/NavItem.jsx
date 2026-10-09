import { Link, NavLink } from 'react-router-dom'

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