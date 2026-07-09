import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Shirt, RefreshCw } from 'lucide-react'
import { useWardrobeItems, useDeleteItem, useToggleFavorite } from '../../hooks/useWardrobe'
import type { WardrobeFilters } from '../../api/wardrobe.api'

const FF = 'Baloo Tamma 2, sans-serif'

const CATEGORIES = ['All', 'TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
const STYLES = ['All', 'CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'CLASSIC'] as const

type CatFilter = typeof CATEGORIES[number]
type StyleFilter = typeof STYLES[number]

function Toast({ msg, visible }: { msg: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, background: 'var(--bg-card)', border: '1px solid var(--border-solid)', borderRadius: 13, padding: '13px 22px', boxShadow: 'var(--shadow-lg)', fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: 10, minWidth: 220 }}
        >✓ {msg}</motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Wardrobe() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const [cat, setCat] = useState<CatFilter>('All')
  const [style, setStyle] = useState<StyleFilter>('All')
  const [toast, setToast] = useState('')
  const [toastV, setToastV] = useState(false)

  const filters: WardrobeFilters = {
    search: search || undefined,
    category: cat !== 'All' ? cat : undefined,
    style: style !== 'All' ? style : undefined,
    limit: 60,
  }

  const { data, isLoading, isError, refetch } = useWardrobeItems(filters)
  const deleteMut = useDeleteItem()
  const favoriteMut = useToggleFavorite()

  function showToast(msg: string) {
    setToast(msg)
    setToastV(true)
    setTimeout(() => setToastV(false), 2800)
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return
    await deleteMut.mutateAsync(id)
    showToast('Clothing removed successfully')
  }

  async function handleFavorite(id: string, isFav: boolean) {
    const { data: res } = await favoriteMut.mutateAsync(id)
    showToast(res.message ?? (isFav ? 'Removed from Favorites' : 'Added to Favorites'))
  }

  const items = data?.items ?? []

  const pillBase: React.CSSProperties = { fontFamily: FF, fontSize: 13.5, fontWeight: 600, padding: '6px 15px', borderRadius: 9, border: '1.5px solid var(--border-solid)', background: 'var(--bg-card)', color: 'var(--text-body)', cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none' }
  const pillActive: React.CSSProperties = { ...pillBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }

  return (
    <div className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 30, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title-lg">My Wardrobe</h1>
          <p className="page-subtitle">
            {isLoading ? 'Loading…' : `${data?.total ?? 0} item${data?.total !== 1 ? 's' : ''} in your closet`}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/wardrobe/add')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '11px 20px', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}><Plus size={16} /> Add Clothes</motion.button>
      </div>

      <div style={{ position: 'relative', maxWidth: 340, marginBottom: 24 }}>
        <Search size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, brand, color…" style={{ width: '100%', height: 44, border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '0 17px 0 42px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }} onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }} onBlur={e => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 28, marginBottom: 40, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>CATEGORY</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCat(c)} style={cat === c ? pillActive : pillBase} onMouseEnter={e => { if (cat !== c) { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' } }} onMouseLeave={e => { if (cat !== c) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>STYLE</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => setStyle(s)} style={style === s ? pillActive : pillBase} onMouseEnter={e => { if (style !== s) { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' } }} onMouseLeave={e => { if (style !== s) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', gap: 12 }}>
          <RefreshCw size={22} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontFamily: FF, fontSize: 15, color: 'var(--text-muted)' }}>Loading your wardrobe…</span>
          <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
        </div>
      )}

      {isError && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <p style={{ fontFamily: FF, fontSize: 15, color: '#e03a3a', marginBottom: 16 }}>Failed to load wardrobe.</p>
          <button onClick={() => refetch()} style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--accent)', background: 'none', border: '1.5px solid var(--accent)', borderRadius: 10, padding: '9px 20px', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ width: 76, height: 76, background: 'var(--secondary-soft)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <Shirt size={36} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="page-title" style={{ marginBottom: 9 }}>Your wardrobe is empty</h2>
          <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 30 }}>{search ? 'No items match your search.' : 'Start by adding your first clothing item.'}</p>
          {!search && (
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => navigate('/wardrobe/add')} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '12px 22px', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }} onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}><Plus size={16} /> Add Clothes</motion.button>
          )}
        </motion.div>
      )}

      {!isLoading && items.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 18 }}>
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: i * 0.04 }} whileHover={{ y: -4, scale: 1.012 }} onClick={() => navigate(`/wardrobe/${item.id}`)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ height: 140, background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.clothingName} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />}
                {item.isFavorite && (<div style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg></div>)}
                {item.laundryStatus !== 'CLEAN' && (<div style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 11, fontWeight: 700, fontFamily: FF, background: item.laundryStatus === 'NEEDS_WASHING' ? '#e03a3a' : '#e07020', color: '#fff', padding: '2px 9px', borderRadius: 99 }}>{item.laundryStatus === 'NEEDS_WASHING' ? 'Wash' : 'Soon'}</div>)}
              </div>
              <div style={{ padding: '12px 14px 14px' }}>
                <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{item.category} {item.style ? `· ${item.style}` : ''}</div>
                <div style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.clothingName}</div>
                <div style={{ fontFamily: FF, fontSize: 12, color: 'var(--text-muted)' }}>{[item.color, item.material, item.size].filter(Boolean).join(' · ')}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <Toast msg={toast} visible={toastV} />
    </div>
  )
}