import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, X, AlertTriangle } from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'
import type { Category, ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const CATEGORIES: ('All' | Category)[] = ['All', 'Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories']

// ── Delete confirmation modal ──────────────────────────────────────────────────
function DeleteModal({
  open, itemName, onCancel, onConfirm,
}: { open: boolean; itemName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.24, ease: [0.34, 1.1, 0.64, 1] }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 18, padding: '30px 28px 24px', width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)', textAlign: 'center', position: 'relative' }}
          >
            <button onClick={onCancel}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><X size={18} /></button>

            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(224,58,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={26} style={{ color: '#e03a3a' }} />
            </div>

            <h2 style={{ fontFamily: FH, fontSize: 21, color: 'var(--text-heading)', marginBottom: 8 }}>
              Remove Item?
            </h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.55 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-body)' }}>{itemName}</strong> from the system?<br />
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={onCancel}
                style={{ flex: 1, fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
              >Cancel</button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                style={{ flex: 1, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#e03a3a', border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}
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

// ── Table header cell ──────────────────────────────────────────────────────────
function TH({ children, w }: { children: React.ReactNode; w?: number | string }) {
  return (
    <th style={{
      fontFamily: FF, fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)',
      padding: '13px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)',
      whiteSpace: 'nowrap', width: w, background: 'var(--bg-alt)',
    }}>
      {children}
    </th>
  )
}

// ── Table data cell ────────────────────────────────────────────────────────────
function TD({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{
      fontFamily: FF, fontSize: 14, fontWeight: muted ? 500 : 600,
      color: muted ? 'var(--text-muted)' : 'var(--text-body)',
      padding: '13px 16px', borderBottom: '1px solid var(--border)',
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )
}

// ── Category pill ──────────────────────────────────────────────────────────────
function CatPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        fontFamily: FF, fontSize: 13.5, fontWeight: 600,
        padding: '8px 18px', borderRadius: 10,
        border: 'none',
        background: active ? '#2b1f0e' : 'var(--bg-card)',
        color: active ? '#fff' : 'var(--text-body)',
        cursor: 'pointer', transition: 'all 0.18s',
        boxShadow: active ? '0 2px 8px rgba(43,31,14,0.18)' : 'none',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--secondary-soft)'; e.currentTarget.style.color = 'var(--accent)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-body)' } }}
    >
      {label}
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminWardrobeData() {
  const { items, removeItem } = useWardrobe()

  const [search,        setSearch]        = useState('')
  const [activeCategory,setActiveCategory]= useState<'All' | Category>('All')
  const [deleteTarget,  setDeleteTarget]  = useState<ClothingItem | null>(null)

  const filtered = useMemo(() =>
    items.filter(item => {
      const matchSearch   = item.name.toLowerCase().includes(search.toLowerCase()) ||
                            item.color.toLowerCase().includes(search.toLowerCase())
      const matchCategory = activeCategory === 'All' || item.category === activeCategory
      return matchSearch && matchCategory
    }),
    [items, search, activeCategory]
  )

  function confirmDelete() {
    if (!deleteTarget) return
    removeItem(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ padding: '32px 32px 80px', background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FH, fontSize: 34, color: 'var(--text-heading)', marginBottom: 6 }}>
          Clothing Management
        </h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
          View, edit, and manage all uploaded clothing items
        </p>
      </div>

      {/* Search + Category filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', maxWidth: 360 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or color..."
            style={{
              width: '100%', height: 44,
              border: '1.5px solid var(--border-solid)', borderRadius: 11,
              padding: '0 16px 0 40px',
              fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)',
              background: 'var(--bg-card)', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Category pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <CatPill
              key={cat}
              label={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden', marginBottom: 14,
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH w={200}>Item</TH>
                <TH w={110}>Category</TH>
                <TH w={110}>Color</TH>
                <TH w={120}>Style</TH>
                <TH w={120}>Occasion</TH>
                <TH w={80}>Worn</TH>
                <TH w={130}>Owner</TH>
                <TH w={80}>Actions</TH>
              </tr>
            </thead>

            <AnimatePresence mode="popLayout">
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}
                      style={{ padding: '52px 24px', textAlign: 'center', fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}
                    >
                      {items.length === 0
                        ? 'No items found'
                        : `No items matching "${search || activeCategory}"`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, i) => (
                    <motion.tr key={item.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* Item */}
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          {/* Color swatch / image */}
                          <div style={{
                            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                            background: item.colorHex + '55',
                            border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', position: 'relative',
                          }}>
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                              : <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.colorHex, boxShadow: '0 1px 4px rgba(0,0,0,0.14)' }} />
                            }
                          </div>
                          <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                        </div>
                      </TD>

                      {/* Category */}
                      <TD>
                        <span style={{
                          fontFamily: FF, fontSize: 12, fontWeight: 700,
                          padding: '3px 11px', borderRadius: 99,
                          background: 'var(--bg-alt)', color: 'var(--text-body)',
                          whiteSpace: 'nowrap',
                        }}>
                          {item.category}
                        </span>
                      </TD>

                      {/* Color */}
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 13, height: 13, borderRadius: '50%', background: item.colorHex, border: '1.5px solid rgba(0,0,0,0.10)', flexShrink: 0 }} />
                          <span style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-body)', fontWeight: 600 }}>{item.color}</span>
                        </div>
                      </TD>

                      {/* Style */}
                      <TD muted>{item.style}</TD>

                      {/* Occasion */}
                      <TD muted>{item.occasion}</TD>

                      {/* Worn */}
                      <TD>
                        <span style={{
                          fontFamily: FF, fontSize: 13, fontWeight: 700,
                          color: item.timesWorn > 0 ? 'var(--accent)' : 'var(--text-muted)',
                        }}>
                          {item.timesWorn}×
                        </span>
                      </TD>

                      {/* Owner */}
                      <TD muted>
                        <span style={{
                          fontFamily: FF, fontSize: 12.5, fontWeight: 600,
                          padding: '3px 10px', borderRadius: 99,
                          background: 'rgba(255,213,134,0.20)', color: '#9c6b10',
                        }}>
                          Melgeri
                        </span>
                      </TD>

                      {/* Actions */}
                      <td style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                        <motion.button
                          whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                          onClick={() => setDeleteTarget(item)}
                          title={`Remove ${item.name}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '5px 6px',
                            borderRadius: 7, display: 'flex', alignItems: 'center',
                            transition: 'color 0.18s, background 0.18s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#e03a3a'; e.currentTarget.style.background = 'rgba(224,58,58,0.08)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
                        >
                          <Trash2 size={17} />
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </AnimatePresence>
          </table>
        </div>
      </div>

      {/* Footer count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''} shown
          {(search || activeCategory !== 'All') && ` of ${items.length} total`}
        </span>

        {/* Per-category breakdown */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories'] as Category[]).map(cat => {
              const count = items.filter(i => i.category === cat).length
              if (count === 0) return null
              return (
                <span key={cat} style={{
                  fontFamily: FF, fontSize: 12, fontWeight: 700,
                  padding: '3px 11px', borderRadius: 99,
                  background: 'var(--bg-alt)', color: 'var(--text-muted)',
                }}>
                  {cat}: {count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <DeleteModal
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </motion.div>
  )
}