import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Camera, Tag, Sparkles,
  Cloud, CalendarDays, Leaf, Users, ArrowRight,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.52, delay: i * 0.08, ease: [0.34, 1.1, 0.64, 1] as const },
  }),
}

const STEPS = [
  { Icon: Camera,   title: '1. Upload Clothes',   desc: 'Snap or upload photos of every item' },
  { Icon: Tag,      title: '2. Label & Organize', desc: 'Category, color, style, and size' },
  { Icon: Sparkles, title: '3. Get Outfits',      desc: 'AI generates daily combinations' },
]

const FEATURES = [
  { Icon: Camera,       title: 'Snap & Organize',        desc: 'Upload your clothes once. We categorize by color, fabric, style, and occasion automatically.' },
  { Icon: Sparkles,     title: 'Smart Outfit Generator',  desc: 'Hybrid recommendation engine creates outfits using color harmony, style, and weather.' },
  { Icon: Users,        title: 'Community-Powered',       desc: 'Collaborative filtering learns from outfits that real users love — and applies it to your wardrobe.' },
  { Icon: Cloud,        title: 'Weather-Aware',           desc: "Outfit suggestions adapt to today's temperature, humidity, and rain probability." },
  { Icon: CalendarDays, title: '7-Day Planner',           desc: 'Plan a full week of non-repetitive outfits matched to your schedule and the forecast.' },
  { Icon: Leaf,         title: 'Eco Insights',            desc: 'Track wardrobe utilization and avoided purchases — wear more of what you already own.' },
]

const S = { ff: 'Baloo Tamma 2, sans-serif' as const, fh: 'Bagel Fat One, cursive' as const }

function BtnPrimary({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'var(--accent)', color: '#fff', borderRadius: 50,
      padding: '15px 30px', fontFamily: S.ff, fontSize: 15.5, fontWeight: 700,
      textDecoration: 'none', transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >{children}</Link>
  )
}

function BtnOutline({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-card)', color: 'var(--text-heading)', borderRadius: 50,
      padding: '15px 30px', fontFamily: S.ff, fontSize: 15.5, fontWeight: 600,
      textDecoration: 'none', border: '1.5px solid var(--border-solid)', transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary-soft)'; e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >{children}</Link>
  )
}

function IconBox({ Icon }: { Icon: React.ElementType }) {
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 15, background: 'var(--secondary-soft)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s', flexShrink: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary)'; e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'var(--secondary-soft)'; e.currentTarget.style.transform = 'none' }}
    ><Icon size={24} style={{ color: 'var(--accent)' }} /></div>
  )
}

export default function Home() {
  return (
    <div style={{ background: 'var(--bg-page)' }}>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto', padding: '90px 24px 70px' }}>
        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={0}
          style={{ fontFamily: S.fh, fontSize: 'clamp(54px,7vw,84px)', lineHeight: 1.06, color: 'var(--text-heading)', marginBottom: 16 }}
        >
          Your Wardrobe.<br />
          <span style={{ color: 'var(--accent)' }}>Smarter.</span>
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={1}
          style={{ fontFamily: S.ff, fontSize: 17.5, fontWeight: 500, lineHeight: 1.65, color: 'var(--text-body)', maxWidth: 540, margin: '0 auto 44px' }}
        >
          Upload your clothes, generate outfits, plan your week, and discover new combinations without buying anything new.
        </motion.p>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}
          style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <BtnPrimary to="/wardrobe">Start Building Wardrobe <ArrowRight size={17} /></BtnPrimary>
          <BtnOutline to="/discover">Explore Community Outfits</BtnOutline>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: 'var(--bg-alt)', padding: '88px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
            style={{ fontFamily: S.ff, fontSize: 12, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', textAlign: 'center', color: 'var(--accent)', marginBottom: 16 }}
          >HOW IT WORKS</motion.p>

          <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
            className="page-title-lg"
            style={{ textAlign: 'center', margin: '0 auto 56px' }}
          >Three steps to a smarter closet</motion.h2>

          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {STEPS.map(({ Icon, title, desc }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: i * 0.08 }}
                whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }}
                style={{ flex: 1, minWidth: 230, background: 'var(--bg-card)', borderRadius: 16, padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border)', cursor: 'default' }}
              >
                <IconBox Icon={Icon} />
                <div style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)' }}>{title}</div>
                <div style={{ fontFamily: S.ff, fontSize: 14.5, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.55 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      <section style={{ background: 'var(--bg-page)', padding: '88px 24px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
            style={{ fontFamily: S.ff, fontSize: 12, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', textAlign: 'center', color: 'var(--accent)', marginBottom: 16 }}
          >CORE FEATURES</motion.p>

          <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
            className="page-title-lg"
            style={{ textAlign: 'center', margin: '0 auto 56px' }}
          >Your Wardrobe, Reimagined</motion.h2>

          <div className="ss-grid-3">
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.44, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -5, boxShadow: 'var(--shadow-md)' }}
                style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '34px 30px 38px', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--border)', cursor: 'default', transition: 'border-color 0.22s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--secondary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <IconBox Icon={Icon} />
                <div style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)' }}>{title}</div>
                <div style={{ fontFamily: S.ff, fontSize: 14.5, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: 'var(--bg-alt)', padding: '110px 24px 96px', textAlign: 'center' }}>
        <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
          className="page-title-lg"
          style={{ maxWidth: 500, margin: '0 auto 20px' }}
        >Ready to organize your closet?</motion.h2>

        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
          style={{ fontFamily: S.ff, fontSize: 16.5, fontWeight: 500, color: 'var(--text-body)', maxWidth: 440, margin: '0 auto 46px', lineHeight: 1.65 }}
        >Upload your clothes, let the algorithm work, and start wearing smarter outfits today.</motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.16 }}>
          <BtnPrimary to="/wardrobe">Create Your Wardrobe <ArrowRight size={17} /></BtnPrimary>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--border)', padding: '24px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2b1f0e', fontFamily: S.fh, fontSize: 15 }}>S</div>
          <span style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 17, color: 'var(--text-heading)' }}>Style<span style={{ color: 'var(--accent)' }}>Sense</span></span>
        </Link>
        <span style={{ fontFamily: S.ff, fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
          © 2026 StyleSense — Personalized Outfit Recommendation System. Thesis Project.
        </span>
      </footer>
    </div>
  )
}