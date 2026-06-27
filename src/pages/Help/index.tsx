import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, Mail, Phone, MapPin,
  Rocket, Settings, Key, Server,
  ShoppingBag, CreditCard, Lock, ShieldCheck,
  Handshake, Newspaper, Briefcase, LifeBuoy,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.'
const SUPPORT_EMAIL = 'support@stylesense.app'

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid rgba(160,120,70,0.18)',
  borderRadius: 10,
  padding: '11px 14px',
  fontFamily: FF,
  fontSize: 14,
  color: '#2b1f0e',
  background: '#f7f4ef',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function SSInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={inputStyle}
      onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
      onBlur={e  => { e.target.style.borderColor = 'rgba(160,120,70,0.18)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

function SSTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{ ...inputStyle, resize: 'vertical', minHeight: 130 }}
      onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
      onBlur={e  => { e.target.style.borderColor = 'rgba(160,120,70,0.18)'; e.target.style.boxShadow = 'none' }}
    />
  )
}

// ── Help topic card ───────────────────────────────────────────────────────────
function HelpCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 8px 28px rgba(80,50,20,0.12)', borderColor: '#FF8C00' }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        background: '#fffcf8',
        border: '1.5px solid rgba(160,120,70,0.15)',
        borderRadius: 14,
        padding: '22px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.22s',
      }}
    >
      <Icon size={22} style={{ color: '#9c866c', marginBottom: 14 }} strokeWidth={1.6} />
      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: '#2b1f0e', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: FF, fontSize: 13, color: '#9c866c', lineHeight: 1.6 }}>{desc}</div>
    </motion.div>
  )
}

// ── Other request card ────────────────────────────────────────────────────────
function OtherCard({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: '0 6px 24px rgba(80,50,20,0.10)', borderColor: '#FF8C00' }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={{
        background: '#fffcf8',
        border: '1.5px solid rgba(160,120,70,0.15)',
        borderRadius: 14,
        padding: '20px 22px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        transition: 'border-color 0.22s',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: 'rgba(160,120,70,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: '#9c866c' }} strokeWidth={1.6} />
      </div>
      <div>
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: '#2b1f0e', marginBottom: 5 }}>{title}</div>
        <div style={{ fontFamily: FF, fontSize: 13, color: '#9c866c', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </motion.div>
  )
}

// ── Contact info row ──────────────────────────────────────────────────────────
function ContactRow({ icon: Icon, label, lines }: { icon: React.ElementType; label: string; lines: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 26 }}>
      <Icon size={18} style={{ color: '#9c866c', marginTop: 18, flexShrink: 0 }} strokeWidth={1.6} />
      <div>
        <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 4 }}>{label}</div>
        {lines.map((l, i) => (
          <div key={i} style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#2b1f0e' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

// ── Footer column ─────────────────────────────────────────────────────────────
function FooterCol({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <div style={{ fontFamily: FH, fontSize: 17, color: '#2b1f0e', marginBottom: 10 }}>{title}</div>
      <div style={{ fontFamily: FF, fontSize: 13, color: '#9c866c', lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Help() {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  function handleSend() {
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )
    const sub  = encodeURIComponent(subject || 'StyleSense Support Request')
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${sub}&body=${body}`
  }

  const fadeUp = (i: number) => ({
    initial:  { opacity: 0, y: 16 },
    animate:  { opacity: 1, y: 0  },
    transition: { duration: 0.38, delay: i * 0.06 },
  })

  const HELP_TOPICS = [
    { Icon: Rocket,      title: 'Getting Started',    desc: LOREM },
    { Icon: Settings,    title: 'Account Settings',   desc: LOREM },
    { Icon: Key,         title: 'Login & Verification', desc: LOREM },
    { Icon: Server,      title: 'Server Status',      desc: LOREM },
    { Icon: ShoppingBag, title: 'Order Issues',       desc: LOREM },
    { Icon: CreditCard,  title: 'Payments',           desc: LOREM },
    { Icon: Lock,        title: 'Privacy',            desc: LOREM },
    { Icon: ShieldCheck, title: 'Security',           desc: LOREM },
  ]

  const OTHER_REQUESTS = [
    { Icon: Handshake,  title: 'Partnerships',       desc: LOREM },
    { Icon: Newspaper,  title: 'Media & Press',      desc: LOREM },
    { Icon: Briefcase,  title: 'Business Inquiries', desc: LOREM },
    { Icon: LifeBuoy,   title: 'Technical Support',  desc: LOREM },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 36px 0' }}>

        {/* ── Page header ───────────────────────────────────────── */}
        <motion.div {...fadeUp(0)} style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: FH, fontSize: 42, color: '#2b1f0e', marginBottom: 10 }}>Help &amp; Support</h1>
          <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', maxWidth: 640, lineHeight: 1.65 }}>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore. Reach out to us using the form below or browse common topics.
          </p>
        </motion.div>

        {/* ── Two-column: contact info + form ──────────────────── */}
        <motion.div {...fadeUp(1)}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 20, marginBottom: 56 }}
        >
          {/* Left: Contact info */}
          <div style={{
            background: '#fffcf8',
            border: '1.5px solid rgba(160,120,70,0.15)',
            borderRadius: 16, padding: '32px 28px',
          }}>
            <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 28 }}>Contact Information</h2>
            <ContactRow icon={User}    label="NAME"    lines={['John Doe']} />
            <ContactRow icon={Mail}    label="EMAIL"   lines={['john.doe@email.com']} />
            <ContactRow icon={Phone}   label="PHONE"   lines={['+63 912 345 6789']} />
            <ContactRow icon={MapPin}  label="ADDRESS" lines={['123 Sample Street', 'Lorem City, Philippines']} />
          </div>

          {/* Right: Message form */}
          <div style={{
            background: '#fffcf8',
            border: '1.5px solid rgba(160,120,70,0.15)',
            borderRadius: 16, padding: '32px 28px',
          }}>
            <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 24 }}>Send us a Message</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', display: 'block', marginBottom: 8 }}>Name</label>
                <SSInput placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', display: 'block', marginBottom: 8 }}>Email</label>
                <SSInput type="email" placeholder="john.doe@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', display: 'block', marginBottom: 8 }}>Subject</label>
                <SSInput placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div>
                <label style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', display: 'block', marginBottom: 8 }}>Message</label>
                <SSTextarea placeholder="Lorem ipsum dolor sit amet…" value={message} onChange={e => setMessage(e.target.value)} />
              </div>

              <motion.button
                whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
                onClick={handleSend}
                style={{
                  width: '100%', padding: '14px 0',
                  background: '#2b1f0e', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontFamily: FF, fontSize: 15, fontWeight: 700,
                  cursor: 'pointer', transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              >
                Send Message
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── Need Help? ────────────────────────────────────────── */}
        <motion.div {...fadeUp(2)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: FH, fontSize: 28, color: '#2b1f0e' }}>Need Help?</h2>
            <span style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF8C00' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9c866c' }}
            >Browse common topics</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 52 }}>
            {HELP_TOPICS.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.5 + 3)}>
                <HelpCard icon={Icon} title={title} desc={desc} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Other Requests ────────────────────────────────────── */}
        <motion.div {...fadeUp(6)}>
          <h2 style={{ fontFamily: FH, fontSize: 28, color: '#2b1f0e', marginBottom: 20 }}>Other Requests</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 56 }}>
            {OTHER_REQUESTS.map(({ Icon, title, desc }, i) => (
              <motion.div key={title} {...fadeUp(i * 0.5 + 7)}>
                <OtherCard icon={Icon} title={title} desc={desc} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid rgba(160,120,70,0.15)',
        background: '#faf7f2',
        padding: '48px 36px 28px',
        marginTop: 20,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 32,
          marginBottom: 36,
        }}>
          <FooterCol title="About"           desc={LOREM.slice(0, 90)} />
          <FooterCol title="Contact"         desc={LOREM.slice(0, 90)} />
          <FooterCol title="Privacy Policy"  desc={LOREM.slice(0, 90)} />
          <FooterCol title="Terms of Service"desc={LOREM.slice(0, 90)} />
          <FooterCol title="FAQ"             desc={LOREM.slice(0, 90)} />
        </div>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          borderTop: '1px solid rgba(160,120,70,0.12)',
          paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: FF, fontSize: 13, color: '#9c866c' }}>
            © 2026 StyleSense. All rights reserved.
          </span>
          <span style={{ fontFamily: FF, fontSize: 13, color: '#9c866c' }}>
            Lorem ipsum dolor sit amet.
          </span>
        </div>
      </footer>
    </motion.div>
  )
}