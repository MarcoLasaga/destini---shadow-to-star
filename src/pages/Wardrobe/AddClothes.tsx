import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Upload, Camera, Check, ArrowLeft, X } from 'lucide-react'
import type { Category, Fabric, Style, Occasion, Size } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const COLORS: { name: string; hex: string }[] = [
  { name: 'Black',    hex: '#1a1a1a' },
  { name: 'White',    hex: '#f0f0f0' },
  { name: 'Gray',     hex: '#888888' },
  { name: 'Navy',     hex: '#1b2a4a' },
  { name: 'Blue',     hex: '#3b82f6' },
  { name: 'Red',      hex: '#ef4444' },
  { name: 'Green',    hex: '#22c55e' },
  { name: 'Brown',    hex: '#92400e' },
  { name: 'Beige',    hex: '#e8d5b7' },
  { name: 'Pink',     hex: '#f9a8d4' },
  { name: 'Cream',    hex: '#fef9ef' },
  { name: 'Olive',    hex: '#65753a' },
  { name: 'Burgundy', hex: '#800020' },
  { name: 'Khaki',    hex: '#c3b091' },
  { name: 'Orange',   hex: '#f97316' },
]

const CATEGORIES: Category[] = ['Top', 'Bottom', 'Shoes', 'Outerwear', 'Accessories']
const FABRICS: Fabric[]       = ['Cotton', 'Denim', 'Polyester', 'Wool', 'Silk', 'Linen', 'Leather', 'Knit', 'Nylon', 'Other']
const STYLES: Style[]         = ['Casual', 'Formal', 'Sporty', 'Streetwear', 'Minimalist', 'Bohemian', 'Vintage', 'Classic']
const OCCASIONS: Occasion[]   = ['School', 'Work', 'Gym', 'Party', 'Date', 'Outdoor', 'Everyday']
const SIZES: Size[]           = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

const label: React.CSSProperties = {
  fontFamily: 'Baloo Tamma 2, sans-serif',
  fontSize: 11, fontWeight: 700,
  letterSpacing: '0.10em', textTransform: 'uppercase',
  color: '#9c866c', marginBottom: 10, display: 'block',
}

function pill(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'Baloo Tamma 2, sans-serif',
    fontSize: 13, fontWeight: 600,
    padding: '6px 15px', borderRadius: 8, cursor: 'pointer',
    border: active ? 'none' : '1.5px solid #e0d0be',
    background: active ? '#2b1f0e' : '#fffcf8',
    color: active ? '#fff' : '#5c4a35',
    transition: 'all 0.18s',
    userSelect: 'none',
    boxShadow: active ? '0 3px 10px rgba(43,31,14,0.18)' : 'none',
  }
}

export default function AddClothes() {
  const navigate       = useNavigate()
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [preview,  setPreview]  = useState<string | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [name,     setName]     = useState('')
  const [category, setCategory] = useState<Category>('Top')
  const [color,    setColor]    = useState('Black')
  const [fabric,   setFabric]   = useState<Fabric>('Cotton')
  const [style,    setStyle]    = useState<Style>('Casual')
  const [occasion, setOccasion] = useState<Occasion>('Everyday')
  const [size,     setSize]     = useState<Size>('M')

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

  function hoverOn(e: React.MouseEvent<HTMLButtonElement>, active: boolean) {
    if (!active) {
      e.currentTarget.style.borderColor = '#FF8C00'
      e.currentTarget.style.color       = '#FF8C00'
    }
  }
  function hoverOff(e: React.MouseEvent<HTMLButtonElement>, active: boolean) {
    if (!active) {
      e.currentTarget.style.borderColor = '#e0d0be'
      e.currentTarget.style.color       = '#5c4a35'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '40px 0 80px' }}
    >
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 24px' }}>

        {/* Back */}
        <button onClick={() => navigate('/wardrobe')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#9c866c', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24, padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#FF8C00')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9c866c')}
        >
          <ArrowLeft size={15} /> Back to Wardrobe
        </button>

        {/* Title */}
        <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>Add Clothing</h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>
          Upload or snap a photo, then label your item
        </p>

        {/* Photo zone */}
        <div style={{ border: '1.5px dashed #e0d0be', borderRadius: 14, background: '#fffcf8', padding: '28px 24px', textAlign: 'center', marginBottom: 28 }}>
          {preview ? (
            <div>
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                <img src={preview} alt="preview" style={{ maxHeight: 220, maxWidth: '100%', borderRadius: 10, objectFit: 'contain' }} />
                <button onClick={() => { setPreview(null); setFileName('') }}
                  style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(43,31,14,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
                ><X size={13} /></button>
              </div>
              {fileName && <p style={{ fontFamily: FF, fontSize: 12, color: '#9c866c' }}>{fileName}</p>}
            </div>
          ) : (
            <>
              <p style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, color: '#5c4a35', marginBottom: 16 }}>
                Upload a photo of your clothing
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 9, padding: '9px 18px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00'; e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fffcf8'; e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
                ><Upload size={15} /> Upload File</motion.button>

                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => cameraInputRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: '#fff', background: '#756e9e', border: 'none', borderRadius: 9, padding: '9px 18px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#756e9e' }}
                ><Camera size={15} /> Take Photo</motion.button>
              </div>
              <p style={{ fontFamily: FF, fontSize: 12, color: '#b0a090', fontStyle: 'italic' }}>
                Photo is optional — you can add items without images
              </p>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
        </div>

        {/* Item Name */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>ITEM NAME <span style={{ color: '#756e9e' }}>*</span></span>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g, Black Hoodie"
            style={{ width: '100%', height: 46, border: '1.5px solid #e0d0be', borderRadius: 9, padding: '0 16px', fontFamily: FF, fontSize: 14.5, color: '#5c4a35', background: '#fffcf8', outline: 'none' }}
            onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.25)' }}
            onBlur={e  => { e.target.style.borderColor = '#e0d0be'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>CATEGORY <span style={{ color: '#756e9e' }}>*</span></span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={pill(category === c)}
                onMouseEnter={e => hoverOn(e, category === c)}
                onMouseLeave={e => hoverOff(e, category === c)}
              >{c}</button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>COLOR</span>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {COLORS.map(c => {
              const active = color === c.name
              return (
                <button key={c.name} onClick={() => setColor(c.name)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FF, fontSize: 13, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: active ? 'none' : '1.5px solid #e0d0be', background: active ? '#2b1f0e' : '#fffcf8', color: active ? '#fff' : '#5c4a35', transition: 'all 0.18s' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#5c4a35' } }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.hex, border: '1.5px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Fabric */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>FABRIC</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FABRICS.map(f => (
              <button key={f} onClick={() => setFabric(f)} style={pill(fabric === f)}
                onMouseEnter={e => hoverOn(e, fabric === f)}
                onMouseLeave={e => hoverOff(e, fabric === f)}
              >{f}</button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>STYLE</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => setStyle(s)} style={pill(style === s)}
                onMouseEnter={e => hoverOn(e, style === s)}
                onMouseLeave={e => hoverOff(e, style === s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Occasion */}
        <div style={{ marginBottom: 24 }}>
          <span style={label}>OCCASION</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {OCCASIONS.map(o => (
              <button key={o} onClick={() => setOccasion(o)} style={pill(occasion === o)}
                onMouseEnter={e => hoverOn(e, occasion === o)}
                onMouseLeave={e => hoverOff(e, occasion === o)}
              >{o}</button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div style={{ marginBottom: 36 }}>
          <span style={label}>SIZE</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SIZES.map(s => (
              <button key={s} onClick={() => setSize(s)} style={pill(size === s)}
                onMouseEnter={e => hoverOn(e, size === s)}
                onMouseLeave={e => hoverOff(e, size === s)}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <motion.button whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={handleAdd}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: FF, fontSize: 15, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 10, padding: '14px 20px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#4a3828' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
          ><Check size={16} /> Add to Wardrobe</motion.button>

          <motion.button whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/wardrobe')}
            style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '14px 22px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00'; e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fffcf8'; e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
          >View Wardrobe</motion.button>
        </div>

      </div>
    </motion.div>
  )
}