import { Link, useNavigate } from 'react-router-dom'

export default function LegalPage({ title, updated, sections, prefix, notice, other }) {
  const navigate = useNavigate()

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="wrap legal">
      <article>
        <div className="legal-bar">
          <button type="button" className="legal-back" onClick={goBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </button>
        </div>

        <header className="legal-head">
          <h1>{title}</h1>
          <p className="legal-updated">{updated}</p>
          {notice && <p className="legal-notice">{notice}</p>}
        </header>

        {sections.map((s, i) => (
          <section key={s.title} className="legal-section" aria-labelledby={`${prefix}-${i + 1}`}>
            <h2 id={`${prefix}-${i + 1}`}>
              <span className="legal-num">{i + 1}.</span> {s.title}
            </h2>
            <p>{s.body}</p>
          </section>
        ))}

        {other && (
          <p className="legal-other">
            Also read:{' '}
            <Link to={other.to}>
              {other.label} <span aria-hidden="true">→</span>
            </Link>
          </p>
        )}
      </article>
    </div>
  )
}