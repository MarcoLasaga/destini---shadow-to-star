import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'

const FF = 'Baloo Tamma 2, sans-serif'

interface GapRule { category: string; recommended: number; tip: string }
const GAP_RULES: GapRule[] = [
  { category: 'Top',         recommended: 5, tip: 'top pieces to unlock more outfit combinations.'       },
  { category: 'Bottom',      recommended: 4, tip: 'bottom pieces to unlock more outfit combinations.'    },
  { category: 'Shoes',       recommended: 3, tip: 'shoes pieces to unlock more outfit combinations.'     },
  { category: 'Outerwear',   recommended: 2, tip: 'outerwear pieces to unlock more outfit combinations.' },
  { category: 'Accessories', recommended: 2, tip: 'accessories pieces to unlock more outfit combinations.'},
]
interface Gap { category: string; label: string; priority: 'HIGH' | 'LOW'; message: string; tip: string; isHigh: boolean }

export default function Cookbook() {
  const navigate   = useNavigate()
  const { items }  = useWardrobe()

  const gaps = useMemo<Gap[]>(() => {
    const result: Gap[] = []
    GAP_RULES.forEach(rule => {
      const count   = items.filter(i => i.category === rule.category).length
      const missing = rule.recommended - count
      if (count === 0) {
        result.push({ category: rule.category, label: rule.category, priority: 'HIGH', isHigh: true,
          message: `No ${rule.category.toLowerCase()} items in your wardrobe`,
          tip: `Add at least ${rule.recommended} ${rule.tip}` })
      } else if (missing > 0) {
        result.push({ category: rule.category, label: rule.category, priority: 'LOW', isHigh: false,
          message: `Limited ${rule.category.toLowerCase()} options (${count} / ${rule.recommended} recommended)`,
          tip: `Consider ${missing} more ${rule.category.toLowerCase()} piece${missing > 1 ? 's' : ''} for variety.` })
      }
    })
    const hasOuterwear = items.filter(i => i.category === 'Outerwear').length > 0
    if (items.length > 0 && !hasOuterwear) {
      result.push({ category: 'Rain', label: 'Rain', priority: 'LOW', isHigh: false,
        message: 'No rain-friendly outerwear', tip: 'A water-resistant jacket would expand your weather range.' })
    }
    return result
  }, [items])

  const cardBg     = (high: boolean) => high ? 'rgba(255,100,60,0.10)' : 'var(--bg-card)'
  const cardBorder = (high: boolean) => high ? 'rgba(224,58,58,0.35)' : 'var(--border)'

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
          style={{ marginBottom: 34, textAlign: 'center' }}
        >
          <h1 className="page-title-lg">Cookbook</h1>
          <p className="page-subtitle">AI-driven review of your wardrobe completeness.</p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 38 }}>
          {gaps.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '54px 24px', textAlign: 'center' }}
            >
              <div style={{ width: 68, height: 68, background: 'var(--secondary-soft)', borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 19px' }}>
                <Sparkles size={29} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 className="page-title" style={{ fontSize: 23, marginBottom: 9 }}>Your wardrobe looks great!</h2>
              <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)' }}>No major gaps detected. Keep building variety for even more outfit combinations.</p>
            </motion.div>
          ) : (
            gaps.map((gap, i) => (
              <motion.div key={gap.category + i}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: i * 0.06 }}
                whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
                style={{ background: cardBg(gap.isHigh), border: `1.5px solid ${cardBorder(gap.isHigh)}`, borderRadius: 13, padding: '19px 21px', cursor: 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <AlertTriangle size={17} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: gap.isHigh ? '#e03a3a' : 'var(--text-heading)', marginBottom: 4 }}>{gap.label}</div>
                      <div style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--text-body)', marginBottom: 3 }}>{gap.message}</div>
                      <div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>{gap.tip}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>{gap.priority}</div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: gaps.length * 0.06 + 0.1 }}
          style={{ display: 'flex', gap: 13, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/wardrobe/add')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '12px 24px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
          ><Sparkles size={15} /> Add Clothes</motion.button>
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/analytics')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-body)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '11px 24px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' }}
          >View Sustainability</motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}