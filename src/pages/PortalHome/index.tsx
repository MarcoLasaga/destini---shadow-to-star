import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Camera, Database, FlaskConical, Smartphone, Users } from 'lucide-react'

const PORTAL_AREAS = [
  { icon: Smartphone, label: 'Primary product', title: 'The mobile app is where wardrobe work happens.', text: 'Capture clothes, receive outfit recommendations, and manage your wardrobe from the device you already carry.' },
  { icon: Database, label: 'Shared foundation', title: 'One source of truth for the system.', text: 'Authentication, wardrobe records, image storage, and analysis services are shared behind the mobile experience.' },
  { icon: FlaskConical, label: 'Research surface', title: 'A web workspace for evaluation.', text: 'Review system activity, recommendation results, model performance, and thesis evidence in a larger workspace.' },
]

const METRICS = [
  { value: '01', label: 'primary client', detail: 'mobile' },
  { value: '03', label: 'portal lanes', detail: 'operations · research · public' },
  { value: '01', label: 'shared data layer', detail: 'Supabase + services' },
]

export default function PortalHome() {
  return (
    <div className="portal-page">
      <section className="portal-hero portal-container">
        <div className="portal-hero-copy">
          <p className="portal-kicker"><span className="portal-kicker-dot" /> StyleSense web portal · system workspace</p>
          <h1>The product lives in your pocket. The evidence lives here.</h1>
          <p className="portal-lede">StyleSense is a mobile-first wardrobe system. This web portal supports the people who operate, study, and evaluate it.</p>
          <div className="portal-hero-actions">
            <Link className="portal-button portal-button-dark portal-button-large" to="/login">Enter the workspace <ArrowRight size={17} /></Link>
            <a className="portal-text-link" href="#why-web">Why a web portal? <ArrowRight size={15} /></a>
          </div>
        </div>
        <div className="portal-hero-panel" aria-label="System architecture summary">
          <div className="portal-panel-caption">Current system shape</div>
          <div className="portal-system-line portal-system-mobile"><Camera size={17} /><span>Mobile application</span><b>primary</b></div>
          <div className="portal-system-connector" />
          <div className="portal-system-line"><Database size={17} /><span>Shared data &amp; services</span><b>core</b></div>
          <div className="portal-system-connector" />
          <div className="portal-system-line portal-system-web"><BarChart3 size={17} /><span>Web portal</span><b>support</b></div>
          <p className="portal-panel-note">A deliberate split of responsibilities, not a duplicate interface.</p>
        </div>
      </section>

      <section className="portal-metrics portal-container" aria-label="Portal scope">
        {METRICS.map(metric => <div className="portal-metric" key={metric.label}><strong>{metric.value}</strong><span>{metric.label}</span><small>{metric.detail}</small></div>)}
      </section>

      <section className="portal-section portal-container" id="why-web">
        <div className="portal-section-heading">
          <p className="portal-kicker">A narrower job, done better</p>
          <h2>Web is not the second wardrobe.</h2>
          <p>It exists for tasks that benefit from a larger screen, structured review, and system-level visibility.</p>
        </div>
        <div className="portal-area-grid">
          {PORTAL_AREAS.map(({ icon: Icon, label, title, text }) => <article className="portal-area" key={label}>
            <div className="portal-area-icon"><Icon size={19} /></div>
            <p>{label}</p>
            <h3>{title}</h3>
            <span>{text}</span>
          </article>)}
        </div>
      </section>

      <section className="portal-section portal-section-quiet portal-container">
        <div className="portal-operations-copy"><p className="portal-kicker">For the team</p><h2>Operate from one calm surface.</h2><p>Use the portal to inspect users, wardrobe data, recommendation behavior, and model readiness without exposing internal tooling inside the mobile product.</p></div>
        <div className="portal-ops-list"><div><Users size={17} /><span>User and access review</span></div><div><Database size={17} /><span>Wardrobe data inspection</span></div><div><FlaskConical size={17} /><span>Research and thesis evidence</span></div></div>
      </section>

      <footer className="portal-footer portal-container"><span>© 2026 StyleSense</span><span>Mobile-first wardrobe intelligence</span><div><Link to="/privacy-policy">Privacy</Link><Link to="/terms-of-service">Terms</Link></div></footer>
    </div>
  )
}
