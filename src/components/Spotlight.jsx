import { Link } from 'react-router-dom'
import PhoneMock from './PhoneMock.jsx'

export default function Spotlight({ eyebrow, title, text, cta, phone, reverse = false, tone = 'tint' }) {
  return (
    <section className={`spot spot-${tone}${reverse ? ' rev' : ''}`}>
      <div className="wrap spot-grid">
        <div className="spot-copy">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
          <p className="lead">{text}</p>
          {cta && (
            <Link className="text-link" to={cta.to}>
              {cta.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        <div className="spot-phone">
          <PhoneMock {...phone} className="phone-lg" />
        </div>
      </div>
    </section>
  )
}