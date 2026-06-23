import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shirt, Heart, TrendingUp, Camera, Tag, Sparkles,
  Cloud, CalendarDays, Leaf, Users, ArrowRight,
} from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.52, delay: i * 0.08, ease: [0.34, 1.1, 0.64, 1] as const },
  }),
}

const WARDROBE_CARDS = [
  { bg: '#f0ede8', Icon: Shirt,       label: 'WARDROBE ITEM', name: 'Top • Cotton',   ic: 'rgba(60,40,20,0.35)',    tc: '#2b1f0e' },
  { bg: '#b8bfc6', Icon: Shirt,       label: 'WARDROBE ITEM', name: 'Bottom • Denim', ic: 'rgba(255,255,255,0.55)', tc: '#fff'    },
  { bg: '#e8b4b8', Icon: Heart,       label: 'WARDROBE ITEM', name: 'Saved • Casual', ic: 'rgba(255,255,255,0.55)', tc: '#fff'    },
  { bg: '#b8c8b8', Icon: TrendingUp,  label: 'WARDROBE ITEM', name: 'Trending Now',   ic: 'rgba(255,255,255,0.55)', tc: '#fff'    },
]

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

const S = {
  ff: 'Baloo Tamma 2, sans-serif' as const,
  fh: 'Bagel Fat One, cursive' as const,
}

function BtnPrimary({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: '#2b1f0e', color: '#fff', borderRadius: 50,
      padding: '14px 28px', fontFamily: S.ff, fontSize: 14.5, fontWeight: 700,
      textDecoration: 'none', transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = '#4a3828'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(43,31,14,0.22)' }}
    onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >{children}</Link>
  )
}

function BtnOutline({ children, to }: { children: React.ReactNode; to: string }) {
  return (
    <Link to={to} style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: '#fffcf8', color: '#2b1f0e', borderRadius: 50,
      padding: '14px 28px', fontFamily: S.ff, fontSize: 14.5, fontWeight: 600,
      textDecoration: 'none', border: '1.5px solid rgba(160,120,70,0.25)', transition: 'all 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,213,134,0.25)'; e.currentTarget.style.borderColor = '#ffd586'; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseLeave={e => { e.currentTarget.style.background = '#fffcf8'; e.currentTarget.style.borderColor = 'rgba(160,120,70,0.25)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >{children}</Link>
  )
}

function IconBox({ Icon }: { Icon: React.ElementType }) {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 13, background: 'rgba(255,213,134,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s', flexShrink: 0,
    }}
    onMouseEnter={e => { e.currentTarget.style.background = '#ffd586'; e.currentTarget.style.transform = 'scale(1.1) rotate(-5deg)' }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,213,134,0.3)'; e.currentTarget.style.transform = 'none' }}
    ><Icon size={22} style={{ color: '#756e9e' }} /></div>
  )
}

export default function Home() {
  return (
    <div style={{ background: '#faf7f2' }}>

      {/* ── HERO ── */}
      <section style={{ paddingTop: 80, paddingBottom: 0, textAlign: 'center', maxWidth: 800, margin: '0 auto', padding: '80px 24px 0' }}>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 30,
            padding: '5px 16px', marginBottom: 32,
            border: '1.5px solid #ffd586', color: '#756e9e',
            background: 'rgba(255,213,134,0.18)',
            fontFamily: S.ff, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em',
          }}
        >
          <Sparkles size={13} style={{ color: '#ffd586' }} />
          YOUR AI WARDROBE ASSISTANT
        </motion.div>

        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={1}
          style={{ fontFamily: S.fh, fontSize: 'clamp(50px,6vw,76px)', lineHeight: 1.08, color: '#2b1f0e', marginBottom: 14 }}
        >
          Your Wardrobe.<br />
          <span style={{ color: '#756e9e' }}>Smarter.</span>
        </motion.h1>

        <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={2}
          style={{ fontFamily: S.ff, fontSize: 16.5, fontWeight: 500, lineHeight: 1.65, color: '#5c4a35', maxWidth: 500, margin: '0 auto 40px' }}
        >
          Upload your clothes, generate outfits, plan your week, and discover new combinations without buying anything new.
        </motion.p>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
          style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 64 }}
        >
          <BtnPrimary to="/wardrobe">Start Building Wardrobe <ArrowRight size={16} /></BtnPrimary>
          <BtnOutline to="/discover">Explore Community Outfits</BtnOutline>
        </motion.div>
      </section>

      {/* ── WARDROBE CARDS ── */}
      <section style={{ padding: '0 24px 80px', maxWidth: 940, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {WARDROBE_CARDS.map((card, i) => (
            <motion.div key={i}
              variants={fadeUp} initial="hidden" animate="visible" custom={i + 4}
              whileHover={{ y: -5, scale: 1.015, boxShadow: '0 6px 24px rgba(80,50,20,0.10)' }}
              style={{
                background: card.bg, flex: 1, minWidth: 155, maxWidth: 230,
                minHeight: 204, borderRadius: 14, padding: 18,
                display: 'flex', flexDirection: 'column', gap: 8, cursor: 'default',
              }}
            >
              <card.Icon size={24} style={{ color: card.ic }} strokeWidth={1.5} />
              <div style={{ flex: 1 }} />
              <div style={{ fontFamily: S.ff, fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: i === 0 ? 'rgba(60,40,20,0.45)' : 'rgba(255,255,255,0.65)' }}>
                {card.label}
              </div>
              <div style={{ fontFamily: S.ff, fontSize: 15, fontWeight: 800, color: card.tc }}>
                {card.name}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: '#ede5d8', padding: '84px 24px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
            style={{ fontFamily: S.ff, fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', textAlign: 'center', color: '#756e9e', marginBottom: 14 }}
          >HOW IT WORKS</motion.p>

          <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
            style={{ fontFamily: S.fh, fontSize: 'clamp(30px,3.8vw,48px)', textAlign: 'center', color: '#2b1f0e', marginBottom: 52 }}
          >Three steps to a smarter closet</motion.h2>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {STEPS.map(({ Icon, title, desc }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: i * 0.08 }}
                whileHover={{ y: -4, boxShadow: '0 6px 24px rgba(80,50,20,0.10)' }}
                style={{ flex: 1, minWidth: 220, background: '#fdf8f2', borderRadius: 14, padding: '34px 30px', display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid rgba(160,120,70,0.15)', cursor: 'default' }}
              >
                <IconBox Icon={Icon} />
                <div style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 17, color: '#2b1f0e' }}>{title}</div>
                <div style={{ fontFamily: S.ff, fontSize: 14, fontWeight: 500, color: '#9c866c', lineHeight: 1.55 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ── */}
      <section style={{ background: '#faf7f2', padding: '84px 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
            style={{ fontFamily: S.ff, fontSize: 11, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', textAlign: 'center', color: '#756e9e', marginBottom: 14 }}
          >CORE FEATURES</motion.p>

          <motion.h2 initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
            style={{ fontFamily: S.fh, fontSize: 'clamp(30px,3.8vw,48px)', textAlign: 'center', color: '#2b1f0e', marginBottom: 52 }}
          >Your Wardrobe, Reimagined</motion.h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -5, boxShadow: '0 6px 24px rgba(80,50,20,0.10)' }}
                style={{ background: '#fdf8f2', borderRadius: 14, padding: '32px 28px 36px', display: 'flex', flexDirection: 'column', gap: 14, border: '1px solid rgba(160,120,70,0.15)', cursor: 'default', transition: 'border-color 0.22s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#ffd586')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(160,120,70,0.15)')}
              >
                <IconBox Icon={Icon} />
                <div style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 17, color: '#2b1f0e' }}>{title}</div>
                <div style={{ fontFamily: S.ff, fontSize: 13.5, fontWeight: 500, color: '#9c866c', lineHeight: 1.62 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background: '#ede5d8', padding: '100px 24px 90px', textAlign: 'center' }}>
        <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44 }}
          style={{ fontFamily: S.fh, fontSize: 'clamp(32px,4.2vw,52px)', color: '#2b1f0e', maxWidth: 460, margin: '0 auto 18px', lineHeight: 1.15 }}
        >Ready to organize your closet?</motion.h2>

        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.08 }}
          style={{ fontFamily: S.ff, fontSize: 15.5, fontWeight: 500, color: '#5c4a35', maxWidth: 420, margin: '0 auto 42px', lineHeight: 1.65 }}
        >Upload your clothes, let the algorithm work, and start wearing smarter outfits today.</motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.44, delay: 0.16 }}>
          <BtnPrimary to="/wardrobe">Create Your Wardrobe <ArrowRight size={16} /></BtnPrimary>
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#faf7f2', borderTop: '1px solid rgba(160,120,70,0.15)', padding: '22px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#ffd586', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2b1f0e', fontFamily: S.fh, fontSize: 14 }}>S</div>
          <span style={{ fontFamily: S.ff, fontWeight: 800, fontSize: 16, color: '#2b1f0e' }}>Style<span style={{ color: '#756e9e' }}>Sense</span></span>
        </Link>
        <span style={{ fontFamily: S.ff, fontSize: 12.5, fontWeight: 500, color: '#9c866c' }}>
          © 2026 StyleSense — Personalized Outfit Recommendation System. Thesis Project.
        </span>
      </footer>
    </div>
  )
}