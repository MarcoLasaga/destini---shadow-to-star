import { Link } from 'react-router-dom'

const columns = [
  { title: 'Product', links: [['Features', '/features'], ['How It Works', '/how-it-works'], ['Download', '/download']] },
  { title: 'Company', links: [['About', '/about'], ['Contact', '/contact']] },
  { title: 'Legal', arrow: true, links: [['Privacy Policy', '/privacy-policy'], ['Terms & Conditions', '/terms']] },
]

export default function Footer({ dark = false }) {
  return (
    <footer className={`site-footer${dark ? ' is-dark' : ''}`}>
      <div className="footer">
        <div className="footer-main">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="footer-title">{col.title}</h3>
              <ul>
                {col.links.map(([label, to]) => (
                  <li key={label}>
                    {to.startsWith('mailto:') ? (
                      <a href={to}>{label}</a>
                    ) : (
                      <Link to={to}>
                        {label}
                        {col.arrow && <span className="arr" aria-hidden="true">→</span>}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="footer-action">
            <h3 className="footer-title">Get the app</h3>
            <p>StyleSense lives on your phone, right where your closet is.</p>
            <Link to="/download" className="footer-cta">
              Go to Download <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        <Link to="/" className="footer-mark" aria-label="StyleSense, back to home">
          Style<span>Sense</span>
        </Link>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} StyleSense. An academic project on wardrobe recommendation.</p>
          <a href="mailto:hello@stylesense.app">hello@stylesense.app</a>
        </div>
      </div>
    </footer>
  )
}
