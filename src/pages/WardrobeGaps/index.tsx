import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// ── Gap definitions ──────────────────────────────────────────────────────────
interface GapRule {
  category:    string
  recommended: number
  tip:         string
  weatherTip?: string
}

const GAP_RULES: GapRule[] = [
  { category: 'Top',         recommended: 5, tip: 'top pieces to unlock more outfit combinations.' },
  { category: 'Bottom',      recommended: 4, tip: 'bottom pieces to unlock more outfit combinations.' },
  { category: 'Shoes',       recommended: 3, tip: 'shoes pieces to unlock more outfit combinations.' },
  { category: 'Outerwear',   recommended: 2, tip: 'outerwear pieces to unlock more outfit combinations.' },
  { category: 'Accessories', recommended: 2, tip: 'accessories pieces to unlock more outfit combinations.' },
]

// One extra "weather" gap shown only when wardrobe has enough items
const WEATHER_GAP = {
  category: 'Rain',
  label: 'Rain',
  message: 'No rain-friendly outerwear',
  tip: 'A water-resistant jacket would expand your weather range.',
}

type Priority = 'HIGH' | 'LOW'

interface Gap {
  category:  string
  label:     string
  priority:  Priority
  message:   string
  tip:       string
  isHigh:    boolean
}

// ── Shared sub-components ────────────────────────────────────────────────────
// ── Button components ───────────────────────────────────────────────────────
function BtnPrimary({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        fontFamily: FF, fontSize: 14, fontWeight: 700,
        color: '#fff', background: '#2b1f0e',
        border: 'none', borderRadius: 10,
        padding: '11px 22px', cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
      onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
    >
      <Sparkles size={14} /> {label}
    </motion.button>
  )
}

function BtnOutline({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        fontFamily: FF, fontSize: 14, fontWeight: 600,
        color: '#2b1f0e', background: '#fffcf8',
        border: '1.5px solid #e0d0be', borderRadius: 10,
        padding: '10px 22px', cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#FF8C00'
        e.currentTarget.style.color       = '#FF8C00'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e0d0be'
        e.currentTarget.style.color       = '#2b1f0e'
      }}
    >
      {label}
    </motion.button>
  )
}

// ── Shared sub-components ────────────────────────────────────────────────────
function GapCard({ gap, index }: { gap: Gap; index: number }) {
  const isHigh = gap.isHigh

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.06 }}
      style={{
        background:   isHigh ? 'rgba(255,200,180,0.25)' : '#fffcf8',
        border:       `1.5px solid ${isHigh ? 'rgba(224,112,32,0.35)' : 'rgba(160,120,70,0.15)'}`,
        borderRadius: 12,
        padding:      '18px 20px',
        transition:   'box-shadow 0.22s, border-color 0.22s, transform 0.22s',
        cursor:       'default',
      }}
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(80,50,20,0.09)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <AlertTriangle
            size={16}
            style={{ color: '#e07020', flexShrink: 0, marginTop: 2 }}
          />
          <div>
            <div style={{
              fontFamily: FF, fontWeight: 800, fontSize: 14.5,
              color: isHigh ? '#e07020' : '#2b1f0e', marginBottom: 4,
            }}>
              {gap.label}
            </div>
            <div style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: '#2b1f0e', marginBottom: 3 }}>
              {gap.message}
            </div>
            <div style={{ fontFamily: FF, fontSize: 12.5, color: '#9c866c' }}>
              {gap.tip}
            </div>
          </div>
        </div>
        {/* Priority badge */}
        <div style={{
          fontFamily: FF, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          color: '#9c866c', flexShrink: 0, marginTop: 2,
        }}>
          {gap.priority}
        </div>
      </div>
    </motion.div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function WardrobeGaps() {
  const navigate = useNavigate()
  const { items } = useWardrobe()

  // Derive gaps from real wardrobe state
  const gaps = useMemo<Gap[]>(() => {
    const result: Gap[] = []

    GAP_RULES.forEach(rule => {
      const count = items.filter((i: ClothingItem) => i.category === rule.category).length
      const missing = rule.recommended - count

      if (count === 0) {
        result.push({
          category: rule.category,
          label:    rule.category,
          priority: 'HIGH',
          message:  `No ${rule.category.toLowerCase()} items in your wardrobe`,
          tip:      `Add at least ${rule.recommended} ${rule.tip}`,
          isHigh:   true,
        })
      } else if (missing > 0) {
        result.push({
          category: rule.category,
          label:    rule.category,
          priority: 'LOW',
          message:  `Limited ${rule.category.toLowerCase()} options (${count} / ${rule.recommended} recommended)`,
          tip:      `Consider ${missing} more ${rule.category.toLowerCase()} piece${missing > 1 ? 's' : ''} for variety.`,
          isHigh:   false,
        })
      }
    })

    // Weather gap — only show when wardrobe has items
    const hasOuterwear = items.filter((i: ClothingItem) => i.category === 'Outerwear').length > 0
    if (items.length > 0 && !hasOuterwear) {
      result.push({
        category: 'Rain',
        label:    'Rain',
        priority: 'LOW',
        message:  WEATHER_GAP.message,
        tip:      WEATHER_GAP.tip,
        isHigh:   false,
      })
    }

    return result
  }, [items])

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38 }}
        style={{ marginBottom: 32 }}
      >
        <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>
          Wardrobe Gap Analysis
        </h1>
        <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>
          AI-driven review of your wardrobe completeness.
        </p>
      </motion.div>

      {/* Gap cards */}
      <div style={{ maxWidth: 660, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 36 }}>
        {gaps.length === 0 ? (
          // Perfect wardrobe state
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: '#fffcf8',
              border: '1.5px solid rgba(160,120,70,0.15)',
              borderRadius: 14, padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 64, height: 64,
              background: 'rgba(255,213,134,0.3)',
              borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 18px',
            }}>
              <Sparkles size={28} style={{ color: '#756e9e' }} />
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 8 }}>
              Your wardrobe looks great!
            </h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c' }}>
              No major gaps detected. Keep building variety for even more outfit combinations.
            </p>
          </motion.div>
        ) : (
          gaps.map((gap, i) => (
            <GapCard key={gap.category + i} gap={gap} index={i} />
          ))
        )}
      </div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: gaps.length * 0.06 + 0.1 }}
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
      >
        <BtnPrimary label="Add Clothes"        onClick={() => navigate('/wardrobe/add')} />
        <BtnOutline label="View Sustainability" onClick={() => navigate('/analytics')} />
      </motion.div>
    </motion.div>
  )
}