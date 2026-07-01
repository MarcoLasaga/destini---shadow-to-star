import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, CheckCircle, Share2, Trash2,
  ArrowUpFromLine, Smile, ArrowDownToLine,
  Star, X, Info,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

type FitReaction = 'tight' | 'perfect' | 'loose' | null

interface OutfitItem {
  name: string; image: string; style: string; occasion: string; fit: FitReaction
}
interface SavedOutfit {
  id: string; title: string; items: OutfitItem[]; savedDate: string
  wornCount: number; favorited: boolean; rating: number | null; reaction: string | null
}

const MOCK_OUTFITS: SavedOutfit[] = [
  {
    id: '1', title: 'Sporty everyday Look', savedDate: '6/30/2026', wornCount: 0,
    favorited: false, rating: null, reaction: null,
    items: [
      { name: 'White T-Shirt',  image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&q=80', style: 'CASUAL', occasion: 'EVERYDAY', fit: null },
      { name: 'Gray Joggers',   image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=300&q=80', style: 'SPORTY',  occasion: 'GYM',      fit: null },
      { name: 'Running Shoes',  image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80', style: 'SPORTY',  occasion: 'GYM',      fit: null },
    ],
  },
  {
    id: '2', title: 'Casual everyday Look', savedDate: '6/30/2026', wornCount: 0,
    favorited: false, rating: null, reaction: null,
    items: [
      { name: 'White T-Shirt',  image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&q=80', style: 'CASUAL', occasion: 'EVERYDAY', fit: null },
      { name: 'Gray Joggers',   image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=300&q=80', style: 'SPORTY',  occasion: 'GYM',      fit: null },
      { name: 'Running Shoes',  image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80', style: 'SPORTY',  occasion: 'GYM',      fit: null },
      { name: 'Denim Jacket',   image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=300&q=80', style: 'CASUAL',  occasion: 'OUTDOOR',  fit: null },
    ],
  },
  {
    id: '3', title: 'Sporty Work Look', savedDate: '6/30/2026', wornCount: 0,
    favorited: false, rating: null, reaction: null,
    items: [
      { name: 'White T-Shirt',  image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&q=80', style: 'CASUAL',  occasion: 'EVERYDAY', fit: null },
      { name: 'Gray Joggers',   image: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=300&q=80', style: 'SPORTY',   occasion: 'GYM',      fit: null },
      { name: 'Running Shoes',  image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80', style: 'SPORTY',   occasion: 'GYM',      fit: null },
      { name: 'Gray Wool Coat', image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=300&q=80', style: 'CLASSIC', occasion: 'WORK',   fit: null },
    ],
  },
  {
    id: '4', title: 'Smart Work Look', savedDate: '6/30/2026', wornCount: 0,
    favorited: true, rating: null, reaction: null,
    items: [
      { name: 'Blue Shirt',  image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=300&q=80', style: 'FORMAL', occasion: 'WORK', fit: null },
      { name: 'Gray Pants',  image: 'https://images.unsplash.com/photo-1560243563-062bfc001d68?w=300&q=80', style: 'FORMAL', occasion: 'WORK', fit: null },
      { name: 'Dress Shoes', image: 'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=300&q=80', style: 'FORMAL', occasion: 'WORK', fit: null },
    ],
  },
]

// ── Toast ──────────────────────────────────────────────────────────────────
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
            borderRadius: 13, padding: '14px 22px', boxShadow: 'var(--shadow-lg)',
            fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--text-heading)',
            display: 'flex', alignItems: 'center', gap: 11, minWidth: 230,
          }}
        >
          <CheckCircle size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%', transform: 'translateX(-50%)',
              background: '#2b1f0e', color: '#fff', fontFamily: FF, fontSize: 11.5, fontWeight: 600,
              padding: '4px 11px', borderRadius: 7, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 100,
            }}
          >{label}</motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 18 }} transition={{ duration: 0.26, ease: [0.34, 1.1, 0.64, 1] }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 20, padding: '30px 30px 26px', width: '100%', maxWidth: 440, boxShadow: 'var(--shadow-lg)', position: 'relative' }}
          >
            <button onClick={onClose}
              style={{ position: 'absolute', top: 18, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><X size={19} /></button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Worn Modal ─────────────────────────────────────────────────────────────
function WornModal({ open, outfit, onClose }: { open: boolean; outfit: SavedOutfit | null; onClose: (rating?: number, reaction?: string, note?: string) => void }) {
  const [stars, setStars]       = useState(0)
  const [hover, setHover]       = useState(0)
  const [reaction, setReaction] = useState('')
  const [note, setNote]         = useState('')

  function submit() {
    onClose(stars || undefined, reaction || undefined, note || undefined)
    setStars(0); setHover(0); setReaction(''); setNote('')
  }

  const FACES = [
    { key: 'Loved it', Icon: Heart },
    { key: 'Good',     Icon: Smile },
    { key: 'Meh',      Icon: Smile },
    { key: 'Not great',Icon: Smile },
  ]

  return (
    <Modal open={open} onClose={() => onClose()}>
      <h2 style={{ fontFamily: FH, fontSize: 23, color: 'var(--text-heading)', marginBottom: 7 }}>
        How did today's outfit work for you?
      </h2>
      {outfit && (
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 22 }}>
          Rating <strong style={{ color: 'var(--text-body)' }}>{outfit.title}</strong>
        </p>
      )}
      <div style={{ display: 'flex', gap: 9, marginBottom: 22, justifyContent: 'center' }}>
        {[1,2,3,4,5].map(n => (
          <Star key={n} size={30}
            fill={(hover || stars) >= n ? 'var(--secondary)' : 'none'}
            stroke={(hover || stars) >= n ? 'var(--secondary)' : 'var(--border-solid)'}
            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setStars(n)}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 20 }}>
        {FACES.map(({ key, Icon }) => (
          <button key={key} onClick={() => setReaction(reaction === key ? '' : key)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '13px 9px', borderRadius: 11, cursor: 'pointer', border: `1.5px solid ${reaction === key ? 'var(--accent)' : 'var(--border-solid)'}`, background: reaction === key ? 'rgba(117,110,158,0.10)' : 'var(--bg-page)', transition: 'all 0.18s' }}
            onMouseEnter={e => { if (reaction !== key) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)' }}
            onMouseLeave={e => { if (reaction !== key) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
          >
            <Icon size={21} style={{ color: reaction === key ? 'var(--accent)' : 'var(--text-muted)' }} />
            <span style={{ fontFamily: FF, fontSize: 11.5, fontWeight: 600, color: reaction === key ? 'var(--accent)' : 'var(--text-body)' }}>{key}</span>
          </button>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)}
        placeholder="Anything to remember about this look? (optional)" rows={3}
        style={{ width: '100%', borderRadius: 11, padding: '11px 15px', fontFamily: FF, fontSize: 14, color: 'var(--text-body)', background: 'var(--bg-input)', border: '1.5px solid var(--border-solid)', outline: 'none', resize: 'vertical', marginBottom: 22 }}
        onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
        onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 11 }}>
        <button onClick={() => onClose()}
          style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '10px 22px', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-body)' }}
        >Skip</button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={submit}
          style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '10px 24px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
        >Save Rating</motion.button>
      </div>
    </Modal>
  )
}

// ── Share Modal ────────────────────────────────────────────────────────────
function ShareModal({ open, outfit, onClose }: { open: boolean; outfit: SavedOutfit | null; onClose: () => void }) {
  const [caption, setCaption] = useState('')
  function post() { setCaption(''); onClose() }
  return (
    <Modal open={open} onClose={onClose}>
      <h2 style={{ fontFamily: FH, fontSize: 23, color: 'var(--text-heading)', marginBottom: 7 }}>Share to community feed</h2>
      {outfit && (
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
          Posting <strong style={{ color: 'var(--text-body)' }}>{outfit.title}</strong> to the StyleSense feed.
        </p>
      )}
      <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)…"
        style={{ width: '100%', height: 46, borderRadius: 11, padding: '0 15px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', background: 'var(--bg-input)', border: '1.5px solid var(--accent)', outline: 'none', marginBottom: 22, boxShadow: '0 0 0 3px var(--secondary-soft)' }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 11 }}>
        <button onClick={onClose}
          style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '10px 22px', cursor: 'pointer' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
        >Cancel</button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={post}
          style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '10px 24px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
        >Post</motion.button>
      </div>
    </Modal>
  )
}

// ── Outfit Card ────────────────────────────────────────────────────────────
function OutfitCard({ outfit, onFavorite, onWorn, onShare, onDelete, onFitChange }: {
  outfit: SavedOutfit; onFavorite: () => void; onWorn: () => void
  onShare: () => void; onDelete: () => void; onFitChange: (i: number, fit: FitReaction) => void
}) {
  const iconBtn = (active = false, danger = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: active ? 'var(--accent)' : danger ? '#e03a3a' : 'var(--text-muted)', transition: 'all 0.18s',
  })
  const fitBtn = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px', borderRadius: 7,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: active ? 'var(--accent)' : 'var(--text-muted)', transition: 'all 0.18s',
  })

  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.38 }}
      whileHover={{ boxShadow: 'var(--shadow-md)' }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '19px 19px 15px', transition: 'border-color 0.22s, box-shadow 0.22s', height: '100%', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
        <span style={{ fontFamily: FF, fontWeight: 800, fontSize: 15.5, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 9 }}>
          {outfit.title}
        </span>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <Tip label="Favorite">
            <button onClick={onFavorite} style={iconBtn(outfit.favorited)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = outfit.favorited ? 'var(--accent)' : 'var(--text-muted)' }}
            ><Heart size={17} fill={outfit.favorited ? 'var(--accent)' : 'none'} /></button>
          </Tip>
          <Tip label="Mark as Worn">
            <button onClick={onWorn} style={iconBtn()}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><CheckCircle size={17} /></button>
          </Tip>
          <Tip label="Share to Feed">
            <button onClick={onShare} style={iconBtn()}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><Share2 size={17} /></button>
          </Tip>
          <Tip label="Delete Outfit">
            <button onClick={onDelete} style={iconBtn(false, true)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#c00' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e03a3a' }}
            ><Trash2 size={17} /></button>
          </Tip>
        </div>
      </div>

      {/* Images */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 15 }}>
        {outfit.items.map((item, i) => (
          <div key={i} style={{ borderRadius: 11, overflow: 'hidden', position: 'relative', aspectRatio: '3/4' }}>
            <img src={item.image} alt={item.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.currentTarget as HTMLImageElement).src = `https://placehold.co/200x260/e8e5e0/9c866c?text=${encodeURIComponent(item.name)}` }}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 6px 7px' }}>
              <div style={{ fontFamily: FF, fontSize: 8, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: 4, padding: '1px 6px', marginBottom: 3, display: 'inline-block' }}>{item.style}</div><br />
              <div style={{ fontFamily: FF, fontSize: 8, fontWeight: 700, color: '#fff', background: 'var(--accent)', borderRadius: 99, padding: '2px 7px', display: 'inline-block' }}>{item.occasion}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Fit section */}
      <div style={{ marginBottom: 13, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>HOW DOES EACH ITEM FIT?</span>
        </div>
        {outfit.items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: i < outfit.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--text-body)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.name}
              {item.fit && <span style={{ fontFamily: FF, fontSize: 11, color: 'var(--text-muted)', marginLeft: 5 }}>({item.fit})</span>}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <Tip label="Too Tight">
                <button onClick={() => onFitChange(i, item.fit === 'tight' ? null : 'tight')} style={fitBtn(item.fit === 'tight')}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = item.fit === 'tight' ? 'var(--accent)' : 'var(--text-muted)' }}
                ><ArrowUpFromLine size={14} /></button>
              </Tip>
              <Tip label="Perfect">
                <button onClick={() => onFitChange(i, item.fit === 'perfect' ? null : 'perfect')} style={fitBtn(item.fit === 'perfect')}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = item.fit === 'perfect' ? 'var(--accent)' : 'var(--text-muted)' }}
                ><Smile size={14} /></button>
              </Tip>
              <Tip label="Too Loose">
                <button onClick={() => onFitChange(i, item.fit === 'loose' ? null : 'loose')} style={fitBtn(item.fit === 'loose')}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = item.fit === 'loose' ? 'var(--accent)' : 'var(--text-muted)' }}
                ><ArrowDownToLine size={14} /></button>
              </Tip>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)' }}>
          Worn {outfit.wornCount} time{outfit.wornCount !== 1 ? 's' : ''}
          {outfit.reaction && ` · ${outfit.reaction}`}
          {outfit.rating  && ` · ${'★'.repeat(outfit.rating)}`}
        </span>
        <span style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)' }}>Saved {outfit.savedDate}</span>
      </div>
    </motion.div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function SavedOutfits() {
  const [outfits,      setOutfits]      = useState<SavedOutfit[]>(MOCK_OUTFITS)
  const [toast,        setToast]        = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [wornTarget,   setWornTarget]   = useState<SavedOutfit | null>(null)
  const [shareTarget,  setShareTarget]  = useState<SavedOutfit | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg); setToastVisible(true)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 2800)
  }

  function toggleFavorite(id: string) {
    setOutfits(prev => prev.map(o => {
      if (o.id !== id) return o
      const next = { ...o, favorited: !o.favorited }
      showToast(next.favorited ? 'Added to Favorites' : 'Removed from Favorites')
      return next
    }))
  }
  function deleteOutfit(id: string) { setOutfits(prev => prev.filter(o => o.id !== id)); showToast('Outfit Deleted') }
  function handleWornClose(rating?: number, reaction?: string) {
    if (!wornTarget) return
    if (rating !== undefined || reaction) {
      setOutfits(prev => prev.map(o => o.id === wornTarget.id ? { ...o, wornCount: o.wornCount + 1, rating: rating ?? o.rating, reaction: reaction ?? o.reaction } : o))
      showToast('Outfit marked as worn!')
    }
    setWornTarget(null)
  }
  function changeFit(outfitId: string, itemIdx: number, fit: FitReaction) {
    setOutfits(prev => prev.map(o => o.id !== outfitId ? o : { ...o, items: o.items.map((item, i) => i === itemIdx ? { ...item, fit } : item) }))
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto 26px' }}>
        <h1 className="page-title-lg">Saved Outfits</h1>
        <p className="page-subtitle">{outfits.length} saved outfit{outfits.length !== 1 ? 's' : ''}</p>
      </div>

      {outfits.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 1240, margin: '0 auto', background: 'var(--bg-card)', border: '1.5px dashed var(--border-solid)', borderRadius: 18, padding: '76px 24px', textAlign: 'center' }}
        >
          <div style={{ width: 68, height: 68, background: 'var(--secondary-soft)', borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 19px' }}>
            <Heart size={30} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="page-title" style={{ fontSize: 24, marginBottom: 9 }}>No saved outfits yet</h2>
          <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)' }}>Generate outfits and save your favourites to see them here.</p>
        </motion.div>
      )}

      {outfits.length > 0 && (
        <div className="saved-outfits-grid" style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 24, alignItems: 'stretch' }}>
          <AnimatePresence mode="popLayout">
            {outfits.map(outfit => (
              <OutfitCard key={outfit.id} outfit={outfit}
                onFavorite={() => toggleFavorite(outfit.id)}
                onWorn={() => setWornTarget(outfit)}
                onShare={() => setShareTarget(outfit)}
                onDelete={() => deleteOutfit(outfit.id)}
                onFitChange={(i, fit) => changeFit(outfit.id, i, fit)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <style>{`
        @media (max-width: 1199px) { .saved-outfits-grid { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } }
        @media (max-width: 767px)  { .saved-outfits-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <WornModal  open={!!wornTarget}  outfit={wornTarget}  onClose={handleWornClose} />
      <ShareModal open={!!shareTarget} outfit={shareTarget} onClose={() => setShareTarget(null)} />
      <Toast msg={toast} visible={toastVisible} />
      <div id="ss-save-toast" />
    </motion.div>
  )
}