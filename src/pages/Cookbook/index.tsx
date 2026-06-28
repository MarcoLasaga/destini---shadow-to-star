import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'
import { useSettings } from '../../context'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

interface GapRule { category: string; recommended: number; tip: string }

const GAP_RULES: GapRule[] = [
  { category: 'Top',         recommended: 5, tip: 'top pieces to unlock more outfit combinations.'       },
  { category: 'Bottom',      recommended: 4, tip: 'bottom pieces to unlock more outfit combinations.'    },
  { category: 'Shoes',       recommended: 3, tip: 'shoes pieces to unlock more outfit combinations.'     },
  { category: 'Outerwear',   recommended: 2, tip: 'outerwear pieces to unlock more outfit combinations.' },
  { category: 'Accessories', recommended: 2, tip: 'accessories pieces to unlock more outfit combinations.'},
]

interface Gap {
  category: string; label: string; priority: 'HIGH' | 'LOW'
  message: string;  tip: string;   isHigh: boolean
}

export default function Cookbook() {
  const navigate    = useNavigate()
  const { items }   = useWardrobe()
  const { isDark }  = useSettings()

  const gaps = useMemo<Gap[]>(() => {
    const result: Gap[] = []
    GAP_RULES.forEach(rule => {
      const count   = items.filter((i: ClothingItem) => i.category === rule.category).length
      const missing = rule.recommended - count
      if (count === 0) {
        result.push({
          category: rule.category, label: rule.category, priority: 'HIGH', isHigh: true,
          message: `No ${rule.category.toLowerCase()} items in your wardrobe`,
          tip:     `Add at least ${rule.recommended} ${rule.tip}`,
        })
      } else if (missing > 0) {
        result.push({
          category: rule.category, label: rule.category, priority: 'LOW', isHigh: false,
          message: `Limited ${rule.category.toLowerCase()} options (${count} / ${rule.recommended} recommended)`,
          tip:     `Consider ${missing} more ${rule.category.toLowerCase()} piece${missing > 1 ? 's' : ''} for variety.`,
        })
      }
    })
    const hasOuterwear = items.filter((i: ClothingItem) => i.category === 'Outerwear').length > 0
    if (items.length > 0 && !hasOuterwear) {
      result.push({
        category: 'Rain', label: 'Rain', priority: 'LOW', isHigh: false,
        message: 'No rain-friendly outerwear',
        tip: 'A water-resistant jacket would expand your weather range.',
      })
    }
    return result
  }, [items])

  const cardBg   = (high: boolean) => high
    ? isDark ? 'rgba(255,100,60,0.10)' : 'rgba(255,200,180,0.25)'
    : 'var(--bg-card)'
  const cardBorder = (high: boolean) => high
    ? isDark ? 'rgba(255,140,0,0.4)' : 'rgba(224,112,32,0.35)'
    : 'var(--border)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '40px 24px 80px' }}
    >
      {/* Centered container */}
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
          style={{ marginBottom: 32, textAlign: 'center' }}
        >
          <h1 style={{ fontFamily: FH, fontSize: 32, color: 'var(--text-heading)', marginBottom: 6 }}>
            Cookbook
          </h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)' }}>
            AI-driven review of your wardrobe completeness.
          </p>
        </motion.div>

        {/* Gap cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
          {gaps.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'var(--bg-card)', border: '1.5px solid var(--border)',
                borderRadius: 14, padding: '52px 24px', textAlign: 'center',
              }}
            >
              <div style={{
                width: 64, height: 64, background: 'rgba(255,213,134,0.2)',
                borderRadius: 18, display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 18px',
              }}>
                <Sparkles size={28} style={{ color: 'var(--accent)' }} />
              </div>
              <h2 style={{ fontFamily: FH, fontSize: 22, color: 'var(--text-heading)', marginBottom: 8 }}>
                Your wardrobe looks great!
              </h2>
              <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
                No major gaps detected. Keep building variety for even more outfit combinations.
              </p>
            </motion.div>
          ) : (
            gaps.map((gap, i) => (
              <motion.div key={gap.category + i}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.38, delay: i * 0.06 }}
                whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
                style={{
                  background:   cardBg(gap.isHigh),
                  border:       `1.5px solid ${cardBorder(gap.isHigh)}`,
                  borderRadius: 12, padding: '18px 20px', cursor: 'default',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertTriangle size={16} style={{ color: 'var(--accent-hover)', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 14.5, color: gap.isHigh ? 'var(--accent-hover)' : 'var(--text-heading)', marginBottom: 4 }}>
                        {gap.label}
                      </div>
                      <div style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: 'var(--text-body)', marginBottom: 3 }}>
                        {gap.message}
                      </div>
                      <div style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {gap.tip}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
                    {gap.priority}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Actions — centered */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: gaps.length * 0.06 + 0.1 }}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/wardrobe/add')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontFamily: FF, fontSize: 14, fontWeight: 700,
              color: '#2b1f0e', background: 'var(--accent)',
              border: 'none', borderRadius: 10, padding: '11px 22px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#2b1f0e' }}
          >
            <Sparkles size={14} /> Add Clothes
          </motion.button>

          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/analytics')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontFamily: FF, fontSize: 14, fontWeight: 600,
              color: 'var(--text-body)', background: 'var(--bg-card)',
              border: '1.5px solid var(--border-solid)',
              borderRadius: 10, padding: '10px 22px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' }}
          >
            View Sustainability
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  )
}