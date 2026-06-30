import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Heart, TrendingUp, Calendar, DollarSign,
  Sparkles, Trash2, CheckCircle, X, AlertTriangle,
} from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'
import type { LaundryStatus, Season } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const LAUNDRY_OPTIONS: LaundryStatus[] = ['Clean', 'Needs Washing', 'In Laundry']
const SEASON_OPTIONS: Season[] = ['Spring', 'Summer', 'Rainy', 'Winter', 'All Season']

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{   opacity: 0, y: 14, scale: 0.96 }}
          transition={{ duration: 0.24 }}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
            background: 'var(--bg-card)', border: '1px solid var(--border-solid)',
            borderRadius: 12, padding: '13px 20px', boxShadow: 'var(--shadow-lg)',
            fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: 'var(--text-heading)',
            display: 'flex', alignItems: 'center', gap: 10, minWidth: 240,
          }}
        >
          <CheckCircle size={16} style={{ color: 'var(--accent-hover)', flexShrink: 0 }} />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Confirm removal dialog ────────────────────────────────────────────────────
function ConfirmRemoveModal({
  open, itemName, onCancel, onConfirm,
}: { open: boolean; itemName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.94, y: 14 }}
            transition={{ duration: 0.24, ease: [0.34, 1.1, 0.64, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 18,
              padding: '28px 28px 24px', width: '100%', maxWidth: 400,
              boxShadow: 'var(--shadow-lg)', textAlign: 'center', position: 'relative',
            }}
          >
            <button onClick={onCancel}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><X size={18} /></button>

            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(224,58,58,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={26} style={{ color: '#e03a3a' }} />
            </div>

            <h2 style={{ fontFamily: FH, fontSize: 20, color: 'var(--text-heading)', marginBottom: 8 }}>
              Remove this item?
            </h2>
            <p style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 22, lineHeight: 1.55 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-body)' }}>{itemName}</strong> from your wardrobe? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={onCancel}
                style={{
                  fontFamily: FF, fontSize: 14, fontWeight: 600,
                  color: 'var(--text-body)', background: 'none',
                  border: '1.5px solid var(--border-solid)', borderRadius: 10,
                  padding: '10px 22px', cursor: 'pointer',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-hover)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
              >Cancel</button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                style={{
                  fontFamily: FF, fontSize: 14, fontWeight: 700,
                  color: '#fff', background: '#e03a3a',
                  border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#c02020' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#e03a3a' }}
              >Remove</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Insight card ──────────────────────────────────────────────────────────────
function InsightCard({
  icon: Icon, label, value, valueColor,
}: { icon: React.ElementType; label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon size={12} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: FH, fontSize: 22, color: valueColor || 'var(--text-heading)' }}>
        {value}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClothingDetails() {
  const { clothingId } = useParams<{ clothingId: string }>()
  const navigate = useNavigate()
  const { getItem, toggleFavorite, updateLaundryStatus, updateCost, removeItem } = useWardrobe()

  const item = clothingId ? getItem(clothingId) : undefined

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast,        setToast]      = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [costInput,    setCostInput]  = useState(item?.cost?.toString() ?? '')

  function showToast(msg: string) {
    setToast(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2800)
  }

  if (!item) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <p style={{ fontFamily: FF, fontSize: 15, color: 'var(--text-muted)' }}>Clothing item not found.</p>
        <button onClick={() => navigate('/wardrobe')}
          style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer' }}
        >Back to Wardrobe</button>
      </div>
    )
  }

  function handleRemove() {
    if (!item) return
    removeItem(item!.id)
    setConfirmOpen(false)
    navigate('/wardrobe')
    // Toast fires after navigation; in a real router-persisted toast you'd lift this state up.
    setTimeout(() => showToast('Clothing item removed successfully.'), 100)
  }

  function handleFavorite() {
    toggleFavorite(item!.id)
  }

  function handleLaundryChange(status: LaundryStatus) {
    // Only "Mark as Clean" is allowed manually per the spec; others are system-driven.
    if (status !== 'Clean') return
    updateLaundryStatus(item!.id, 'Clean')
    showToast('Marked as Clean')
  }

  function handleCostBlur() {
    const parsed = parseFloat(costInput)
    updateCost(item!.id, isNaN(parsed) ? null : parsed)
  }

  const costPerWear = item.cost && item.timesWorn > 0
    ? `$${(item.cost / item.timesWorn).toFixed(2)}`
    : '—'

  const laundryColor = (status: LaundryStatus) =>
    status === 'Clean' ? '#2a9d5c' : status === 'Needs Washing' ? '#e03a3a' : '#756e9e'

  const pillBase: React.CSSProperties = {
    fontFamily: FF, fontSize: 12.5, fontWeight: 700,
    padding: '5px 14px', borderRadius: 30,
    border: '1.5px solid var(--border-solid)',
    background: 'var(--bg-card)', color: 'var(--text-body)',
    transition: 'all 0.18s', cursor: 'pointer',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '32px 36px 80px' }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        {/* Back link */}
        <button onClick={() => navigate('/wardrobe')}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: FF, fontSize: 13.5, fontWeight: 600,
            color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', marginBottom: 24, padding: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <ArrowLeft size={15} /> Back to wardrobe
        </button>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>

          {/* Left: Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              background: item.colorHex + '20',
              borderRadius: 16, position: 'relative',
              minHeight: 620, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16, position: 'absolute', inset: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: item.colorHex, boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }} />
            )}

            {/* Favorite button */}
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
              onClick={handleFavorite}
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 40, height: 40, borderRadius: '50%',
                background: item.favorited ? 'var(--accent-hover)' : 'var(--bg-card)',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: 'var(--shadow-sm)',
                transition: 'background 0.2s',
              }}
            >
              <Heart size={18} fill={item.favorited ? '#fff' : 'none'} stroke={item.favorited ? '#fff' : 'var(--text-heading)'} />
            </motion.button>
          </motion.div>

          {/* Right: Details */}
          <div>
            {/* Category */}
            <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--accent-hover)', marginBottom: 6 }}>
              {item.category.toUpperCase()}
            </div>

            {/* Name */}
            <h1 style={{ fontFamily: FH, fontSize: 32, color: 'var(--text-heading)', marginBottom: 8 }}>
              {item.name}
            </h1>

            {/* Meta line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: item.colorHex, border: '1.5px solid rgba(0,0,0,0.1)' }} />
              <span style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-body)' }}>
                {item.color} · {item.fabric} · Size {item.size}
              </span>
            </div>

            {/* Tag row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
              <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: 'var(--accent-hover)', background: 'rgba(255,140,0,0.10)', borderRadius: 30, padding: '5px 14px' }}>
                {item.occasion}
              </span>
              <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: 'var(--text-body)', background: 'var(--bg-alt)', borderRadius: 30, padding: '5px 14px' }}>
                {item.style}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontFamily: FF, fontSize: 12, fontWeight: 700,
                color: laundryColor(item.laundryStatus),
                background: laundryColor(item.laundryStatus) + '18',
                borderRadius: 30, padding: '5px 14px',
              }}>
                <Sparkles size={11} /> {item.laundryStatus}
              </span>
              {item.favorited && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: FF, fontSize: 12, fontWeight: 700,
                  color: 'var(--accent-hover)', background: 'rgba(255,140,0,0.10)',
                  borderRadius: 30, padding: '5px 14px',
                }}>
                  <Heart size={11} fill="var(--accent-hover)" /> Favorite
                </span>
              )}
            </div>

            {/* Insights */}
            <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
              INSIGHTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              <InsightCard icon={TrendingUp} label="Times Worn" value={String(item.timesWorn)} />
              <InsightCard icon={Calendar}   label="Last Worn"  value={fmtDate(item.lastWorn)} />
              <InsightCard icon={Sparkles}   label="Date Added" value={fmtDate(item.dateAdded)} />
              <InsightCard icon={DollarSign} label="Cost / Wear" value={costPerWear} />
            </div>

            {/* Cost input (manual, future API-ready) */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                PURCHASE COST (OPTIONAL)
              </div>
              <div style={{ position: 'relative', maxWidth: 200 }}>
                <DollarSign size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="number" min={0} step={0.01}
                  value={costInput}
                  onChange={e => setCostInput(e.currentTarget.value)}
                  onBlur={handleCostBlur}
                  placeholder="0.00"
                  style={{
                    width: '100%', height: 40, borderRadius: 9,
                    padding: '0 12px 0 30px', fontFamily: FF, fontSize: 14,
                    color: 'var(--text-body)', background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-solid)', outline: 'none',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
                />
              </div>
            </div>

            {/* Laundry status */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                LAUNDRY STATUS
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LAUNDRY_OPTIONS.map(opt => {
                  const active = item.laundryStatus === opt
                  const manual = opt === 'Clean'
                  return (
                    <button key={opt}
                      onClick={() => manual && handleLaundryChange(opt)}
                      disabled={!manual && !active}
                      title={!manual && !active ? 'Status set automatically when worn' : undefined}
                      style={{
                        ...pillBase,
                        background: active ? 'var(--accent-hover)' : 'var(--bg-card)',
                        color: active ? '#fff' : 'var(--text-body)',
                        borderColor: active ? 'var(--accent-hover)' : 'var(--border-solid)',
                        cursor: manual ? 'pointer' : 'not-allowed',
                        opacity: !manual && !active ? 0.55 : 1,
                      }}
                      onMouseEnter={e => { if (manual && !active) { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' } }}
                      onMouseLeave={e => { if (manual && !active) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Season compatibility */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                SEASON COMPATIBILITY
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SEASON_OPTIONS.map(season => {
                  const active = item.seasons.includes(season)
                  return (
                    <span key={season}
                      style={{
                        fontFamily: FF, fontSize: 12.5, fontWeight: 700,
                        padding: '5px 14px', borderRadius: 30,
                        border: `1.5px solid ${active ? 'var(--accent-hover)' : 'var(--border-solid)'}`,
                        background: active ? 'rgba(255,140,0,0.10)' : 'var(--bg-card)',
                        color: active ? 'var(--accent-hover)' : 'var(--text-muted)',
                      }}
                    >
                      {season}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Remove button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setConfirmOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontFamily: FF, fontSize: 14, fontWeight: 700,
                color: '#e03a3a', background: 'var(--bg-card)',
                border: '1.5px solid rgba(224,58,58,0.4)', borderRadius: 10,
                padding: '11px 22px', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,58,58,0.08)'; e.currentTarget.style.borderColor = '#e03a3a' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'rgba(224,58,58,0.4)' }}
            >
              <Trash2 size={15} /> Remove
            </motion.button>
          </div>
        </div>
      </div>

      <ConfirmRemoveModal
        open={confirmOpen}
        itemName={item.name}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleRemove}
      />

      <Toast msg={toast} visible={toastVisible} />
    </motion.div>
  )
}