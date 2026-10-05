import { Link } from 'react-router-dom'

const columns = [
  {
    title: 'Explore',
    links: [['Home', '/'], ['Features', '/features'], ['How It Works', '/how-it-works'], ['About', '/about'], ['Download', '/download']],
  },
  {
    title: 'Legal',
    arrow: true,
    links: [['Privacy Policy', '/privacy-policy'], ['Terms & Conditions', '/terms']],
  },
  {
    title: 'Support',
    links: [['Contact', 'mailto:hello@stylesense.app']],
  },
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
                        {col.arrow && <span className="arr" aria-hidden="true"> →</span>}
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

        <p className="footer-mark" aria-hidden="true">
          Style<span>Sense</span>
        </p>

        <div className="footer-bottom">
          <p>© 2026 StyleSense. An academic project on wardrobe recommendation.</p>
          <a href="mailto:hello@stylesense.app">hello@stylesense.app</a>
        </div>
      </div>
    </footer>
  )
}