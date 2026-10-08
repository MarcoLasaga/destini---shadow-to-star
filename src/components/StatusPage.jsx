import Button from './Button.jsx'
import Notice from './Notice.jsx'

export default function StatusPage({ kind = 'success', eyebrow, title, text, detail, primary, secondary, footnote }) {
  return (
    <section className="status wrap" data-kind={kind}>
      <p className="eyebrow rv" style={{ '--d': '0s' }}>{eyebrow}</p>
      <h1 className="rv" style={{ '--d': '0.12s' }}>{title}</h1>
      <p className="lead rv" style={{ '--d': '0.24s' }}>{text}</p>
      {detail && <div className="rv" style={{ '--d': '0.3s' }}><Notice kind={kind}>{detail}</Notice></div>}
      <div className="hero-buttons rv" style={{ '--d': '0.4s' }}>
        <Button variant="primary" to={primary.to}>{primary.label}</Button>
        {secondary && <Button variant="outline" to={secondary.to}>{secondary.label}</Button>}
      </div>
      {footnote && <p className="status-foot">{footnote}</p>}
    </section>
  )
}