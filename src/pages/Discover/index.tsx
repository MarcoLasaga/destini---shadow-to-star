import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Shirt, Sparkles, Share2 } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe.ts'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

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
    const tops       = items.filter((i: ClothingItem) => i.category === 'Top')
    const bottoms    = items.filter((i: ClothingItem) => i.category === 'Bottom')
    const shoes      = items.filter((i: ClothingItem) => i.category === 'Shoes')
    const accessories= items.filter((i: ClothingItem) => i.category === 'Accessories')

    if (tops.length === 0 || bottoms.length === 0) {
      setNotEnough(true)
      setOutfit(null)
      return
    }

    setNotEnough(false)
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

    setOutfit({
      top:       pick(tops),
      bottom:    pick(bottoms),
      shoes:     shoes.length      ? pick(shoes)       : undefined,
      accessory: accessories.length? pick(accessories) : undefined,
    })
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>Community Feed</h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>
            Outfits from the StyleSense community — likes &amp; ratings shape your recommendations
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
          onClick={generateOutfit}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '10px 20px', cursor: 'pointer', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
        >
          <Share2 size={14} /> Share Outfit
        </motion.button>
      </div>

      {/* Not enough clothes state */}
      <AnimatePresence>
        {notEnough && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}
          >
            <div style={{ width: 72, height: 72, background: 'rgba(255,213,134,0.3)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Sparkles size={32} style={{ color: '#756e9e' }} />
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 26, color: '#2b1f0e', marginBottom: 8 }}>Not Enough Clothes</h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>
              Add at least a top and a bottom to generate outfits.
            </p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/wardrobe/add')}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '12px 22px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
            >
              <Sparkles size={15} /> Add Clothes
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated outfit card */}
      <AnimatePresence>
        {outfit && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ maxWidth: 640, margin: '0 auto 28px' }}
          >
            <div style={{ background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(160,120,70,0.1)' }}>
                <div style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 4 }}>GENERATED OUTFIT</div>
                <div style={{ fontFamily: FH, fontSize: 20, color: '#2b1f0e' }}>Today's Look</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, padding: 20 }}>
                {[outfit.top, outfit.bottom, outfit.shoes, outfit.accessory].filter(Boolean).map((item, i) => (
                  <motion.div key={i} whileHover={{ y: -3, boxShadow: '0 4px 16px rgba(80,50,20,0.10)' }}
                    style={{ background: (item!.colorHex) + '22', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(160,120,70,0.12)', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,120,70,0.12)' }}
                  >
                    <div style={{ height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: item!.colorHex, boxShadow: '0 2px 6px rgba(0,0,0,0.14)' }} />
                    </div>
                    <div style={{ padding: '8px 10px 10px' }}>
                      <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 3 }}>{item!.category}</div>
                      <div style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: '#2b1f0e' }}>{item!.name}</div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div style={{ padding: '0 20px 18px', display: 'flex', gap: 10 }}>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={generateOutfit}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '11px 0', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
                >
                  <Sparkles size={14} /> Regenerate
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '11px 18px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
                >
                  Save Outfit
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty feed state (when no outfit generated yet and enough clothes) */}
      {!outfit && !notEnough && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 640, margin: '0 auto' }}
        >
          <div style={{ background: '#fffcf8', border: '1.5px dashed rgba(160,120,70,0.2)', borderRadius: 16, padding: '70px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: 'rgba(255,213,134,0.25)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Shirt size={30} style={{ color: '#756e9e' }} />
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 8 }}>No outfits posted yet</h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>Be the first to share a look from your wardrobe</p>
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={generateOutfit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '12px 24px', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
            >
              Generate an outfit
            </motion.button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}