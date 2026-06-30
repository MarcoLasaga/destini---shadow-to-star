import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, ArrowLeft } from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'

export default function TermsOfService() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper"
      style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', paddingTop: 40 }}>
        <Link to="/help" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', marginBottom: 36 }}>
          <ArrowLeft size={15} /> Back to Help
        </Link>

        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--secondary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <FileText size={32} style={{ color: 'var(--accent)' }} />
        </div>

        <h1 className="page-title-lg">Terms of Service</h1>

        <p style={{ fontFamily: FF, fontSize: 16, color: 'var(--text-body)', lineHeight: 1.7, maxWidth: 560, margin: '20px auto 8px' }}>
          This page is currently being prepared and will outline the terms and conditions for using StyleSense, including account responsibilities, acceptable use, and service limitations.
        </p>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginTop: 12 }}>
          Check back soon for the full terms.
        </p>

        <Link to="/help" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 36,
          fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff',
          background: 'var(--accent)', borderRadius: 30, padding: '13px 28px', textDecoration: 'none',
        }}>
          Return to Help Center
        </Link>
      </div>
    </motion.div>
  )
}