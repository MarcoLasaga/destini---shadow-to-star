import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Download, Plus, Shirt } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'
import type { Category, ClothingItem, Style } from '../../types/wardrobe'

const CATEGORIES: Category[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories']
const STYLES: Style[]         = ['Casual', 'Formal', 'Sporty', 'Streetwear', 'Minimalist', 'Classic']

type CategoryFilter = 'All' | Category
type StyleFilter    = 'All' | Style

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

export default function Wardrobe() {
  const navigate = useNavigate()
  const { items, loadSamples } = useWardrobe()
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All')
  const [activeStyle, setActiveStyle]       = useState<StyleFilter>('All')

  const filtered = items.filter((item: ClothingItem) => {
    const matchSearch   = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'All' || item.category === activeCategory
    const matchStyle    = activeStyle    === 'All' || item.style    === activeStyle
    return matchSearch && matchCategory && matchStyle
  })

  const pillBase: CSSProperties = {
    fontFamily: FF, fontSize: 13, fontWeight: 600, padding: '5px 14px',
    borderRadius: 8, border: '1.5px solid var(--border-solid)', background: 'var(--bg-card)',
    color: 'var(--text-body)', cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none',
  }
  const pillActive: CSSProperties = {
    ...pillBase, background: '#2b1f0e', color: '#fff', borderColor: '#2b1f0e',
  }

  const categoryFilters: CategoryFilter[] = ['All', ...CATEGORIES]
  const styleFilters: StyleFilter[]       = ['All', ...STYLES]

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '36px 36px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: 'var(--text-heading)', marginBottom: 4 }}>My Wardrobe</h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)' }}>{items.length} item{items.length !== 1 ? 's' : ''} in your closet</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={loadSamples}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
          ><Download size={15} /> Load Samples</motion.button>

          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/wardrobe/add')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
          ><Plus size={15} /> Add Clothes</motion.button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your wardrobe..."
          style={{ width: '100%', height: 40, border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '0 16px 0 40px', fontFamily: FF, fontSize: 14, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 36, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>CATEGORY</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categoryFilters.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={activeCategory === cat ? pillActive : pillBase}
                onMouseEnter={e => { if (activeCategory !== cat) { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' } }}
                onMouseLeave={e => { if (activeCategory !== cat) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
              >{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>STYLE</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {styleFilters.map(st => (
              <button key={st} onClick={() => setActiveStyle(st)}
                style={activeStyle === st ? pillActive : pillBase}
                onMouseEnter={e => { if (activeStyle !== st) { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' } }}
                onMouseLeave={e => { if (activeStyle !== st) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
              >{st}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      <AnimatePresence>
        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}
          >
            <div style={{ width: 72, height: 72, background: 'rgba(255,213,134,0.3)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Shirt size={34} style={{ color: 'var(--accent)' }} />
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 24, color: 'var(--text-heading)', marginBottom: 8 }}>Your wardrobe is empty</h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>Start by uploading your clothes or loading sample items.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={loadSamples}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.color = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
              ><Download size={15} /> Load Samples</motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/wardrobe/add')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              ><Plus size={15} /> Upload Clothes</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      {filtered.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 18 }}
        >
          {filtered.map((item: ClothingItem, i: number) => (
            <motion.div key={item.id}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: i * 0.05 }}
              whileHover={{ y: -4, scale: 1.012 }}
              onClick={() => navigate(`/wardrobe/${item.id}`)}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-hover)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ height: 130, background: item.colorHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  : <div style={{ width: 56, height: 56, borderRadius: '50%', background: item.colorHex, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                }
                {item.favorited && (
                  <div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{item.category} · {item.style}</div>
                <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontFamily: FF, fontSize: 12, color: 'var(--text-muted)' }}>{item.color} · {item.fabric} · {item.size}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}