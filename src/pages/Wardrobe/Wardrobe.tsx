import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Download, Plus, Shirt } from 'lucide-react'
import type { ClothingItem, Category, Style } from '../../types/wardrobe'

const SAMPLE_ITEMS: ClothingItem[] = [
  { id: '1', name: 'White T-Shirt',  category: 'Top',         color: 'White', colorHex: '#f0f0f0', fabric: 'Cotton',    style: 'Casual',     occasion: 'Everyday', size: 'M', createdAt: '2026-01-01' },
  { id: '2', name: 'Blue Jeans',     category: 'Bottom',      color: 'Navy',  colorHex: '#1b2a4a', fabric: 'Denim',     style: 'Casual',     occasion: 'Everyday', size: 'M', createdAt: '2026-01-02' },
  { id: '3', name: 'White Sneakers', category: 'Shoes',       color: 'White', colorHex: '#f0f0f0', fabric: 'Leather',   style: 'Casual',     occasion: 'Everyday', size: 'M', createdAt: '2026-01-03' },
  { id: '4', name: 'Oxford Shirt',   category: 'Top',         color: 'Blue',  colorHex: '#3b82f6', fabric: 'Cotton',    style: 'Formal',     occasion: 'Work',     size: 'M', createdAt: '2026-01-04' },
  { id: '5', name: 'Chinos',         category: 'Bottom',      color: 'Khaki', colorHex: '#c3b091', fabric: 'Cotton',    style: 'Classic',    occasion: 'Work',     size: 'M', createdAt: '2026-01-05' },
  { id: '6', name: 'Bomber Jacket',  category: 'Outerwear',   color: 'Olive', colorHex: '#65753a', fabric: 'Nylon',     style: 'Streetwear', occasion: 'Everyday', size: 'L', createdAt: '2026-01-06' },
  { id: '7', name: 'Canvas Tote',    category: 'Accessories', color: 'Beige', colorHex: '#e8d5b7', fabric: 'Cotton',    style: 'Casual',     occasion: 'Everyday', size: 'XL',createdAt: '2026-01-07' },
  { id: '8', name: 'Track Pants',    category: 'Bottom',      color: 'Gray',  colorHex: '#888888', fabric: 'Polyester', style: 'Sporty',     occasion: 'Gym',      size: 'M', createdAt: '2026-01-08' },
]

const CATEGORIES: Category[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories']
const STYLES: Style[]         = ['Casual', 'Formal', 'Sporty', 'Streetwear', 'Minimalist', 'Classic']

type CategoryFilter = 'All' | Category
type StyleFilter    = 'All' | Style

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

export default function Wardrobe() {
  const navigate = useNavigate()
  const [items, setItems]                   = useState<ClothingItem[]>([])
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All')
  const [activeStyle, setActiveStyle]       = useState<StyleFilter>('All')
  const [samplesLoaded, setSamplesLoaded]   = useState(false)

  const filtered = items.filter(item => {
    const matchSearch   = item.name.toLowerCase().includes(search.toLowerCase())
    const matchCategory = activeCategory === 'All' || item.category === activeCategory
    const matchStyle    = activeStyle    === 'All' || item.style    === activeStyle
    return matchSearch && matchCategory && matchStyle
  })

  function loadSamples() {
    if (!samplesLoaded) { setItems(SAMPLE_ITEMS); setSamplesLoaded(true) }
  }

  const pillBase: React.CSSProperties = {
    fontFamily: FF, fontSize: 13, fontWeight: 600, padding: '5px 14px',
    borderRadius: 8, border: '1.5px solid #e0d0be', background: '#fffcf8',
    color: '#5c4a35', cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none',
  }
  const pillActive: React.CSSProperties = {
    ...pillBase, background: '#2b1f0e', color: '#fff', borderColor: '#2b1f0e',
  }

  const categoryFilters: CategoryFilter[] = ['All', ...CATEGORIES]
  const styleFilters: StyleFilter[]       = ['All', ...STYLES]

  return (
    <div style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>My Wardrobe</h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>{items.length} item{items.length !== 1 ? 's' : ''} in your closet</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={loadSamples}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
          ><Download size={15} /> Load Samples</motion.button>

          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/wardrobe/add')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '10px 18px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
          ><Plus size={15} /> Add Clothes</motion.button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#9c866c', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your wardrobe..."
          style={{ width: '100%', height: 40, border: '1.5px solid #e0d0be', borderRadius: 10, padding: '0 16px 0 40px', fontFamily: FF, fontSize: 14, color: '#5c4a35', background: '#fffcf8', outline: 'none' }}
          onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.25)' }}
          onBlur={e  => { e.target.style.borderColor = '#e0d0be'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 28, marginBottom: 36, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>CATEGORY</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {categoryFilters.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={activeCategory === cat ? pillActive : pillBase}
                onMouseEnter={e => { if (activeCategory !== cat) { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' } }}
                onMouseLeave={e => { if (activeCategory !== cat) { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#5c4a35' } }}
              >{cat}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 8 }}>STYLE</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {styleFilters.map(st => (
              <button key={st} onClick={() => setActiveStyle(st)}
                style={activeStyle === st ? pillActive : pillBase}
                onMouseEnter={e => { if (activeStyle !== st) { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' } }}
                onMouseLeave={e => { if (activeStyle !== st) { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#5c4a35' } }}
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
              <Shirt size={34} style={{ color: '#756e9e' }} />
            </div>
            <h2 style={{ fontFamily: FH, fontSize: 24, color: '#2b1f0e', marginBottom: 8 }}>Your wardrobe is empty</h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>Start by uploading your clothes or loading sample items.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={loadSamples}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
              ><Download size={15} /> Load Samples</motion.button>

              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/wardrobe/add')}
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '11px 20px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
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
          {filtered.map((item, i) => (
            <motion.div key={item.id}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: i * 0.05 }}
              whileHover={{ y: -4, scale: 1.012 }}
              style={{ background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(80,50,20,0.10)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(160,120,70,0.15)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ height: 130, background: item.colorHex + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  : <div style={{ width: 56, height: 56, borderRadius: '50%', background: item.colorHex, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
                }
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 4 }}>{item.category} · {item.style}</div>
                <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e', marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontFamily: FF, fontSize: 12, color: '#9c866c' }}>{item.color} · {item.fabric} · {item.size}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}