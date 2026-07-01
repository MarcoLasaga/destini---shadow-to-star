import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Upload, Camera, Check, ArrowLeft, X } from 'lucide-react'
import type { Category, Fabric, Style, Occasion, Size } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'

const COLORS: { name: string; hex: string }[] = [
  { name: 'Black',    hex: '#1a1a1a' }, { name: 'White',    hex: '#f0f0f0' },
  { name: 'Gray',     hex: '#888888' }, { name: 'Navy',     hex: '#1b2a4a' },
  { name: 'Blue',     hex: '#3b82f6' }, { name: 'Red',      hex: '#ef4444' },
  { name: 'Green',    hex: '#22c55e' }, { name: 'Brown',    hex: '#92400e' },
  { name: 'Beige',    hex: '#e8d5b7' }, { name: 'Pink',     hex: '#f9a8d4' },
  { name: 'Cream',    hex: '#fef9ef' }, { name: 'Olive',    hex: '#65753a' },
  { name: 'Burgundy', hex: '#800020' }, { name: 'Khaki',    hex: '#c3b091' },
  { name: 'Orange',   hex: '#f97316' },
]
const CATEGORIES: Category[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories']
const FABRICS: Fabric[]       = ['Cotton', 'Denim', 'Polyester', 'Wool', 'Silk', 'Linen', 'Leather', 'Knit', 'Nylon', 'Other']
const STYLES: Style[]         = ['Casual', 'Formal', 'Sporty', 'Streetwear', 'Minimalist', 'Bohemian', 'Vintage', 'Classic']
const OCCASIONS: Occasion[]   = ['School', 'Work', 'Gym', 'Party', 'Date', 'Outdoor', 'Everyday']
const SIZES: Size[]           = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const label: React.CSSProperties = {
  fontFamily: FF, fontSize: 12, fontWeight: 700, letterSpacing: '0.10em',
  textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 11, display: 'block',
}

function pill(active: boolean): React.CSSProperties {
  return {
    fontFamily: FF, fontSize: 13.5, fontWeight: 600, padding: '7px 16px', borderRadius: 9,
    cursor: 'pointer', border: active ? 'none' : '1.5px solid var(--border-solid)',
    background: active ? 'var(--accent)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text-body)', transition: 'all 0.18s',
    boxShadow: active ? '0 3px 10px rgba(117,110,158,0.25)' : 'none',
    userSelect: 'none' as const,
  }
}

function hoverOn(e: React.MouseEvent<HTMLButtonElement>, active: boolean) {
  if (!active) { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' }
}
function hoverOff(e: React.MouseEvent<HTMLButtonElement>, active: boolean) {
  if (!active) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' }
}

export default function AddClothes() {
  const navigate        = useNavigate()
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const cameraInputRef  = useRef<HTMLInputElement>(null)

  const [preview,   setPreview]   = useState<string | null>(null)
  const [fileName,  setFileName]  = useState('')
  const [name,      setName]      = useState('')
  const [category,  setCategory]  = useState<Category>('Top')
  const [color,     setColor]     = useState('Black')
  const [fabric,    setFabric]    = useState<Fabric>('Cotton')
  const [style,     setStyle]     = useState<Style>('Casual')
  const [occasion,  setOccasion]  = useState<Occasion>('Everyday')
  const [size,      setSize]      = useState<Size>('M')

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  function handleAdd() {
    if (!name.trim()) { alert('Please enter an item name'); return }
    alert(`"${name}" added to wardrobe!`)
    navigate('/wardrobe')
  }

  const inputSt: React.CSSProperties = {
    width: '100%', height: 48, border: '1.5px solid var(--border-solid)', borderRadius: 11,
    padding: '0 17px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)',
    background: 'var(--bg-input)', outline: 'none',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        <button onClick={() => navigate('/wardrobe')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 26, padding: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        ><ArrowLeft size={16} /> Back to Wardrobe</button>

        <h1 className="page-title-lg" style={{ marginBottom: 6 }}>Add Clothing</h1>
        <p className="page-subtitle" style={{ marginBottom: 30 }}>Upload or snap a photo, then label your item</p>

        {/* Photo zone */}
        <div style={{ border: '1.5px dashed var(--border-solid)', borderRadius: 15, background: 'var(--bg-card)', padding: '30px 26px', textAlign: 'center', marginBottom: 30 }}>
          {preview ? (
            <div>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 13 }}>
                <img src={preview} alt="preview" style={{ maxHeight: 230, maxWidth: '100%', borderRadius: 11, objectFit: 'contain' }} />
                <button onClick={() => { setPreview(null); setFileName('') }}
                  style={{ position: 'absolute', top: 7, right: 7, width: 30, height: 30, borderRadius: '50%', background: 'rgba(43,31,14,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                ><X size={14} /></button>
              </div>
              {fileName && <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>{fileName}</p>}
            </div>
          ) : (
            <>
              <p style={{ fontFamily: FF, fontSize: 15, fontWeight: 600, color: 'var(--text-body)', marginBottom: 18 }}>Upload a photo of your clothing</p>
              <div style={{ display: 'flex', gap: 11, justifyContent: 'center', marginBottom: 15 }}>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '10px 20px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
                ><Upload size={16} /> Upload File</motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
                ><Camera size={16} /> Take Photo</motion.button>
              </div>
              <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Photo is optional — you can add items without images
              </p>
            </>
          )}
          <input ref={fileInputRef}   type="file" accept="image/jpeg,image/jpg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"               style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
        </div>

        {/* Item Name */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>ITEM NAME <span style={{ color: 'var(--accent)' }}>*</span></span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g, Black Hoodie"
            style={inputSt}
            onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
            onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>CATEGORY <span style={{ color: 'var(--accent)' }}>*</span></span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={pill(category === c)}
                onMouseEnter={e => hoverOn(e, category === c)} onMouseLeave={e => hoverOff(e, category === c)}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>COLOR</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => {
              const active = color === c.name
              return (
                <button key={c.name} onClick={() => setColor(c.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, padding: '6px 13px', borderRadius: 9, cursor: 'pointer', border: active ? 'none' : '1.5px solid var(--border-solid)', background: active ? 'var(--accent)' : 'var(--bg-card)', color: active ? '#fff' : 'var(--text-body)', transition: 'all 0.18s' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
                >
                  <span style={{ width: 13, height: 13, borderRadius: '50%', background: c.hex, border: '1.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Fabric */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>FABRIC</span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {FABRICS.map(f => (
              <button key={f} onClick={() => setFabric(f)} style={pill(fabric === f)}
                onMouseEnter={e => hoverOn(e, fabric === f)} onMouseLeave={e => hoverOff(e, fabric === f)}
              >{f}</button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>STYLE</span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => setStyle(s)} style={pill(style === s)}
                onMouseEnter={e => hoverOn(e, style === s)} onMouseLeave={e => hoverOff(e, style === s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Occasion */}
        <div style={{ marginBottom: 26 }}>
          <span style={label}>OCCASION</span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {OCCASIONS.map(o => (
              <button key={o} onClick={() => setOccasion(o)} style={pill(occasion === o)}
                onMouseEnter={e => hoverOn(e, occasion === o)} onMouseLeave={e => hoverOff(e, occasion === o)}
              >{o}</button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div style={{ marginBottom: 38 }}>
          <span style={label}>SIZE</span>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)} style={pill(size === s)}
                onMouseEnter={e => hoverOn(e, size === s)} onMouseLeave={e => hoverOff(e, size === s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 13 }}>
          <motion.button whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={handleAdd}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: FF, fontSize: 15.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '15px 22px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
          ><Check size={17} /> Add to Wardrobe</motion.button>
          <motion.button whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/wardrobe')}
            style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '15px 24px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--secondary-soft)'; e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
          >View Wardrobe</motion.button>
        </div>
      </div>
    </motion.div>
  )
}