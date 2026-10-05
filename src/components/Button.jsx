import { Link } from 'react-router-dom'

export default function Button({ variant = 'primary', href, to, children, className = '', ...rest }) {
  const classes = `btn btn-${variant} ${className}`.trim()

  if (to) {
    return (
      <Link className={classes} to={to} {...rest}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a className={classes} href={href} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  )
}