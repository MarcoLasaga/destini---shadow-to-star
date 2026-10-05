import { Link } from 'react-router-dom'

export default function Section({ id, title, linkText, linkHref = '#', children, className = '' }) {
  const arrow = <span aria-hidden="true">→</span>
  return (
    <section id={id} className={`section ${className}`.trim()}>
      <div className="section-head">
        <h2>{title}</h2>
        {linkText &&
          (linkHref.startsWith('/') ? (
            <Link className="text-link" to={linkHref}>{linkText} {arrow}</Link>
          ) : (
            <a className="text-link" href={linkHref}>{linkText} {arrow}</a>
          ))}
      </div>
      {children}
    </section>
  )
}