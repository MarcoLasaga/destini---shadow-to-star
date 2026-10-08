import Photo from './Photo.jsx'

export default function Duo({ items, label }) {
  return (
    <section className="duo" aria-label={label}>
      <div className="wrap duo-grid">
        {items.map((it) => (
          <article key={it.title} className="duo-item">
            <Photo {...it.photo} ratio="4 / 3" />
            {it.num && <span className="duo-num" aria-hidden="true">{it.num}</span>}
            {it.eyebrow && <p className="eyebrow">{it.eyebrow}</p>}
            <h2>{it.title}</h2>
            <p className="lead">{it.text}</p>
            {it.tags && (
              <ul className="tags">
                {it.tags.map((t) => <li key={t}>{t}</li>)}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}