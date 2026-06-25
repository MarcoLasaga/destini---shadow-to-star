import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Shirt, Share2 } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

export default function Community() {
  const navigate = useNavigate()
  const { items } = useWardrobe()

  const hasEnough =
    items.filter(i => i.category === 'Top').length > 0 &&
    items.filter(i => i.category === 'Bottom').length > 0

  function handleShare() {
    if (!hasEnough) {
      navigate('/outfit-generator')
    } else {
      navigate('/outfit-generator')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>
            Community Feed
          </h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>
            Outfits from the StyleSense community — likes &amp; ratings shape your recommendations
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleShare}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            fontFamily: FF, fontSize: 13.5, fontWeight: 700,
            color: '#fff', background: '#2b1f0e',
            border: 'none', borderRadius: 30,
            padding: '10px 20px', cursor: 'pointer', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
        >
          <Share2 size={14} /> Share Outfit
        </motion.button>
      </div>

      {/* Empty state card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ maxWidth: 580, margin: '0 auto' }}
      >
        <div style={{
          background: '#fffcf8',
          border: '1.5px dashed rgba(160,120,70,0.2)',
          borderRadius: 16,
          padding: '80px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64,
            background: 'rgba(255,213,134,0.25)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Shirt size={30} style={{ color: '#756e9e' }} />
          </div>
          <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 8 }}>
            No outfits posted yet
          </h2>
          <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>
            Be the first to share a look from your wardrobe
          </p>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleShare}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontFamily: FF, fontSize: 14, fontWeight: 700,
              color: '#fff', background: '#2b1f0e',
              border: 'none', borderRadius: 30,
              padding: '12px 24px', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
          >
            Generate an outfit
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}