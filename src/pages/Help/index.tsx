import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User, Mail, Phone, MapPin,
  Rocket, Settings, Key, Server,
  ShoppingBag, CreditCard, Lock, ShieldCheck,
  Handshake, Newspaper, Briefcase, LifeBuoy,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'
const SUPPORT_EMAIL = 'support@stylesense.app'

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1.5px solid var(--border)', borderRadius: 11,
  padding: '12px 15px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)',
  background: 'var(--bg-input)', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
}

function SSInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} style={inputStyle}
      onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
      onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
    />
  )
}
function SSTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{ ...inputStyle, resize: 'vertical', minHeight: 140 }}
      onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
      onBlur={e  => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function HelpCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: 'var(--shadow-md)', borderColor: 'var(--secondary)' }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        background: 'var(--bg-card)', border: '1.5px solid var(--border)',
        borderRadius: 15, padding: '24px 22px', cursor: 'pointer', transition: 'border-color 0.22s',
      }}
    >
      <Icon size={23} style={{ color: 'var(--text-muted)', marginBottom: 15 }} strokeWidth={1.6} />
      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 16, color: 'var(--text-heading)', marginBottom: 9 }}>{title}</div>
      <div style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
    </motion.div>
  )
}

function OtherCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: 'var(--shadow-sm)', borderColor: 'var(--secondary)' }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        background: 'var(--bg-card)', border: '1.5px solid var(--border)',
        borderRadius: 15, padding: '22px 24px', cursor: 'pointer',
        display: 'flex', alignItems: 'flex-start', gap: 17, transition: 'border-color 0.22s',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 11, flexShrink: 0, background: 'var(--secondary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} style={{ color: 'var(--accent)' }} strokeWidth={1.6} />
      </div>
      <div>
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 16, color: 'var(--text-heading)', marginBottom: 6 }}>{title}</div>
        <div style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </motion.div>
  )
}

function ContactRow({ icon: Icon, label, lines }: { icon: React.ElementType; label: string; lines: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 15, marginBottom: 28 }}>
      <Icon size={19} style={{ color: 'var(--text-muted)', marginTop: 19, flexShrink: 0 }} strokeWidth={1.6} />
      <div>
        <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function FooterCol({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div style={{ fontFamily: FH, fontSize: 18, color: 'var(--text-heading)', marginBottom: 11 }}>{title}</div>
      <div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

export default function Help() {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  function handleSend() {
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)
    const sub  = encodeURIComponent(subject || 'StyleSense Support Request')
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${sub}&body=${body}`
  }

  const fadeUp = (i: number) => ({
    initial:  { opacity: 0, y: 16 },
    animate:  { opacity: 1, y: 0  },
    transition: { duration: 0.38, delay: i * 0.06 },
  })

  const HELP_TOPICS = [
    { Icon: Rocket,      title: 'Getting Started',
      desc: 'New to StyleSense? Create your account, upload your first clothing items, and let our AI generate outfit combinations tailored to your style in minutes.' },
    { Icon: Settings,    title: 'Account Settings',
      desc: 'Update your profile information, manage notification preferences, change your password, and customize your StyleSense experience from the Settings page.' },
    { Icon: Key,         title: 'Login & Verification',
      desc: 'Having trouble signing in? Learn how to reset your password, verify your email, or troubleshoot common login and account access issues.' },
    { Icon: Server,      title: 'Server Status',
      desc: 'Check the current operational status of StyleSense services, including outfit generation, weather sync, and community feed availability.' },
    { Icon: ShoppingBag, title: 'Order Issues',
      desc: 'Questions about a purchase made through a StyleSense partner retailer? Find guidance on order tracking, returns, and refund requests here.' },
    { Icon: CreditCard,  title: 'Payments',
      desc: 'Manage your billing details, view your subscription plan, update payment methods, and review your StyleSense Premium invoice history.' },
    { Icon: Lock,        title: 'Privacy',
      desc: 'Learn how StyleSense collects, stores, and protects your data, including wardrobe photos, location data, and outfit history.' },
    { Icon: ShieldCheck, title: 'Security',
      desc: 'Keep your account safe with two-factor authentication, active session monitoring, and tools to review and manage connected devices.' },
  ]

  const OTHER_REQUESTS = [
    { Icon: Handshake,  title: 'Partnerships',
      desc: 'Interested in partnering with StyleSense as a clothing brand, retailer, or fashion platform? Reach out to our partnerships team to explore collaboration opportunities.' },
    { Icon: Newspaper,  title: 'Media & Press',
      desc: 'Journalists and content creators can request press kits, interviews, and brand assets, or get in touch for StyleSense feature coverage.' },
    { Icon: Briefcase,  title: 'Business Inquiries',
      desc: 'For enterprise licensing, API access, or other business-related questions, contact our team to discuss how StyleSense can work for your organization.' },
    { Icon: LifeBuoy,   title: 'Technical Support',
      desc: 'Experiencing a bug, broken feature, or unexpected behavior? Send us details about the issue and our support team will investigate promptly.' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div className="ss-page-wrapper" style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 44, paddingBottom: 0 }}>

        <motion.div {...fadeUp(0)} style={{ marginBottom: 40 }}>
          <h1 className="page-title-lg">Help &amp; Support</h1>
          <p style={{ fontFamily: FF, fontSize: 15, color: 'var(--text-muted)', maxWidth: 640, lineHeight: 1.65, marginTop: 8 }}>
            Find answers to common questions, browse our help topics, or reach out to our team directly using the form below.
          </p>
        </motion.div>

        <motion.div {...fadeUp(1)} className="ss-grid-2" style={{ marginBottom: 60 }}>
          {/* Left: Contact info */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 18, padding: '34px 30px' }}>
            <h2 style={{ fontFamily: FH, fontSize: 23, color: 'var(--text-heading)', marginBottom: 30 }}>Contact Information</h2>
            <ContactRow icon={User}   label="NAME"    lines={['StyleSense Support Team']} />
            <ContactRow icon={Mail}   label="EMAIL"   lines={[SUPPORT_EMAIL]} />
            <ContactRow icon={Phone}  label="PHONE"   lines={['+63 912 345 6789']} />
            <ContactRow icon={MapPin} label="ADDRESS" lines={['StyleSense HQ', 'Quezon City, Philippines']} />
          </div>

          {/* Right: Message form */}
          <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 18, padding: '34px 30px' }}>
            <h2 style={{ fontFamily: FH, fontSize: 23, color: 'var(--text-heading)', marginBottom: 26 }}>Send us a Message</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 19 }}>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 9 }}>Name</label>
                <SSInput placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 9 }}>Email</label>
                <SSInput type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 9 }}>Subject</label>
                <SSInput placeholder="What's this about?" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', display: 'block', marginBottom: 9 }}>Message</label>
                <SSTextarea placeholder="Tell us how we can help…" value={message} onChange={e => setMessage(e.target.value)} />
              </div>
              <motion.button
                whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                style={{
                  width: '100%', padding: '15px 0', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 11, fontFamily: FF, fontSize: 15.5, fontWeight: 700,
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
              >
                Send Message
              </motion.button>
            </div>
          </div>
        </motion.div>

        <motion.div {...fadeUp(2)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
            <h2 className="page-title">Need Help?</h2>
            <span style={{ fontFamily: FF, fontSize: 14, color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>
              Browse common topics
            </span>
          </div>
          <div className="ss-grid-4" style={{ marginBottom: 56 }}>
            {HELP_TOPICS.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.5 + 3)}>
                <HelpCard icon={Icon} title={title} desc={desc} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeUp(6)}>
          <h2 className="page-title" style={{ marginBottom: 22 }}>Other Requests</h2>
          <div className="ss-grid-2" style={{ marginBottom: 60 }}>
            {OTHER_REQUESTS.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.5 + 7)}>
                <OtherCard icon={Icon} title={title} desc={desc} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <footer style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-page)', padding: '50px 36px 30px', marginTop: 20 }}>
        <div className="ss-grid-4" style={{ maxWidth: 1200, margin: '0 auto', marginBottom: 36 }}>
          <FooterCol title="About"   desc="StyleSense helps you organize your wardrobe and discover smarter outfit combinations using AI." />
          <FooterCol title="Contact" desc={`Reach our support team at ${SUPPORT_EMAIL} or use the form above.`} />
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, color: 'var(--text-heading)', marginBottom: 11 }}>Privacy Policy</div>
            <Link to="/privacy-policy" style={{ fontFamily: FF, fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Read our Privacy Policy →
            </Link>
          </div>
          <div>
            <div style={{ fontFamily: FH, fontSize: 18, color: 'var(--text-heading)', marginBottom: 11 }}>Terms of Service</div>
            <Link to="/terms-of-service" style={{ fontFamily: FF, fontSize: 13, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
              Read our Terms of Service →
            </Link>
          </div>
        </div>
        <div style={{
          maxWidth: 1200, margin: '0 auto', borderTop: '1px solid var(--border)', paddingTop: 22,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        }}>
          <span style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>
            © 2026 StyleSense. All rights reserved.
          </span>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link to="/privacy-policy" style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link to="/terms-of-service" style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</Link>
          </div>
        </div>
      </footer>
    </motion.div>
  )
}