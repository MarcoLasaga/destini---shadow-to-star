import { motion } from 'framer-motion'
import { Construction } from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'

export default function AdminComingSoon({ title }: { title: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '80px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}
    >
      <div style={{ width: 72, height: 72, borderRadius: 22, background: 'var(--secondary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
        <Construction size={32} style={{ color: 'var(--accent)' }} />
      </div>
      <h2 style={{ fontFamily: 'Bagel Fat One, cursive', fontSize: 28, color: 'var(--text-heading)', marginBottom: 9 }}>{title}</h2>
      <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)' }}>This page is under construction and will be available soon.</p>
    </motion.div>
  )
}