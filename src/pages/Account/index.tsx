import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { User, Sparkles } from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'

export default function Account() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', paddingTop: 60 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: 'var(--secondary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <User size={36} style={{ color: 'var(--accent)' }} />
        </div>

        <h1 className="page-title-lg" style={{ marginBottom: 10 }}>My Account</h1>
        <p className="page-subtitle" style={{ marginBottom: 36 }}>
          Sign in to manage your StyleSense profile, wardrobe preferences, and saved outfits.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: FF, fontSize: 15, fontWeight: 700,
            color: '#fff', background: 'var(--accent)',
            borderRadius: 30, padding: '13px 28px', textDecoration: 'none',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
          >Sign In</Link>

          <Link to="/signup" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: FF, fontSize: 15, fontWeight: 700,
            color: 'var(--text-heading)', background: 'var(--bg-card)',
            border: '1.5px solid var(--border-solid)',
            borderRadius: 30, padding: '13px 28px', textDecoration: 'none',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-heading)' }}
          ><Sparkles size={16} /> Create Account</Link>
        </div>

        <div style={{ marginTop: 52, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '26px 28px', textAlign: 'left' }}>
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: 'var(--text-heading)', marginBottom: 14 }}>What you'll get with an account</div>
          {[
            'Save and sync your wardrobe across devices',
            'Access your outfit history and wear statistics',
            'Share outfits to the community feed',
            'Personalized AI outfit recommendations',
            'Weekly planner with your saved preferences',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />
              <span style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', lineHeight: 1.55 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}