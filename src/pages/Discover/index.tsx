import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shirt, Sparkles, Share2 } from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'

interface GeneratedOutfit {
  top: ClothingItem
  bottom: ClothingItem
  shoes?: ClothingItem
  accessory?: ClothingItem
}

export default function Discover() {
  const navigate = useNavigate()
  const { items } = useWardrobe()
  const [outfit, setOutfit] = useState<GeneratedOutfit | null>(null)
  const [notEnough, setNotEnough] = useState(false)

  function generateOutfit() {
    const tops        = items.filter(i => i.category === 'Top')
    const bottoms      = items.filter(i => i.category === 'Bottom')
    const shoes         = items.filter(i => i.category === 'Shoes')
    const accessories  = items.filter(i => i.category === 'Accessories')

    if (tops.length === 0 || bottoms.length === 0) {
      setNotEnough(true); setOutfit(null); return
    }
    setNotEnough(false)
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    setOutfit({
      top: pick(tops), bottom: pick(bottoms),
      shoes: shoes.length ? pick(shoes) : undefined,
      accessory: accessories.length ? pick(accessories) : undefined,
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title-lg">Community Feed</h1>
          <p className="page-subtitle">Outfits from the StyleSense community — likes &amp; ratings shape your recommendations</p>
        </div>
        <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={generateOutfit}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 30, padding: '11px 22px', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
        ><Share2 size={15} /> Share Outfit</motion.button>
      </div>

      <AnimatePresence>
        {notEnough && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}
          >
            <div style={{ width: 76, height: 76, background: 'var(--secondary-soft)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
              <Sparkles size={34} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="page-title" style={{ marginBottom: 9 }}>Not Enough Clothes</h2>
            <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 30 }}>Add at least a top and a bottom to generate outfits.</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/wardrobe/add')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 30, padding: '13px 24px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
            ><Sparkles size={16} /> Add Clothes</motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {outfit && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ maxWidth: 660, margin: '0 auto 28px' }}
          >
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ padding: '20px 22px 15px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 5 }}>GENERATED OUTFIT</div>
                <div className="page-title" style={{ fontSize: 22 }}>Today's Look</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 13, padding: 22 }}>
                {[outfit.top, outfit.bottom, outfit.shoes, outfit.accessory].filter(Boolean).map((item, i) => (
                  <motion.div key={i} whileHover={{ y: -3, boxShadow: 'var(--shadow-sm)' }}
                    style={{ background: (item!.colorHex) + '22', borderRadius: 13, overflow: 'hidden', border: '1px solid var(--border)', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  >
                    <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: item!.colorHex, boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }} />
                    </div>
                    <div style={{ padding: '9px 11px 11px' }}>
                      <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 3 }}>{item!.category}</div>
                      <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--text-heading)' }}>{item!.name}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div style={{ padding: '0 22px 20px', display: 'flex', gap: 11 }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={generateOutfit}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '12px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
                ><Sparkles size={15} /> Regenerate</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '12px 20px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
                >Save Outfit</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!outfit && !notEnough && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 660, margin: '0 auto' }}>
          <div style={{ background: 'var(--bg-card)', border: '1.5px dashed var(--border-solid)', borderRadius: 18, padding: '76px 24px', textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, background: 'var(--secondary-soft)', borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
              <Shirt size={32} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="page-title" style={{ fontSize: 24, marginBottom: 9 }}>No outfits posted yet</h2>
            <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 30 }}>Be the first to share a look from your wardrobe</p>
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={generateOutfit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 30, padding: '13px 26px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
            >Generate an outfit</motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}