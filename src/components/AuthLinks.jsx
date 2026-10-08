import { Link } from 'react-router-dom'
import Button from './Button.jsx'

export default function AuthLinks({ layout = 'bar', onNavigate }) {
  const menu = layout === 'menu'
  return (
    <div className={`auth-links auth-links-${layout}`}>
      <Link
        to="/login"
        className={menu ? 'btn btn-outline' : 'al-signin'}
        onClick={onNavigate}
      >
        Sign In
      </Link>
      <Button variant="primary" to="/signup" onClick={onNavigate}>Get Started</Button>
    </div>
  )
}