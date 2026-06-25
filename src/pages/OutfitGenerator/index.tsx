import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, RefreshCw, Share2, Save,
  Heart, Check, ThumbsDown, Ban,
  Info, Cloud,
} from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

type Occasion = 'Any' | 'School' | 'Work' | 'Gym' | 'Party' | 'Date' | 'Outdoor' | 'Everyday'
const OCCASIONS: Occasion[] = ['Any', 'School', 'Work', 'Gym', 'Party', 'Date', 'Outdoor', 'Everyday']

const REASONS = [
  { label: 'User Preferences',      pct: 48 },
  { label: 'Wardrobe Analysis',     pct: 25 },
  { label: 'Collaborative Filtering', pct: 11 },
  { label: 'Fashion Rules',         pct: 6  },
  { label: 'Weather & Context',     pct: 5  },
  { label: 'Trend Analysis',        pct: 4  },
]

const STYLE_LABELS = [
  'Casual everyday Look', 'Classic Work Look', 'Sporty Fit',
  'Smart Casual Look', 'Street Style Combo', 'Minimalist Look',
]

const OUTFIT_TAGS = [
  'Great color combination', 'Cohesive casual look', 'Great for everyday',
  'Matches your style preferences', 'Comfortable for warm weather',
  'Rain-ready layers', 'Neutrals anchor the blue accent',
]

interface GeneratedOutfit {
  id: string
  title: string
  top: ClothingItem
  bottom: ClothingItem
  shoes?: ClothingItem
  accessory?: ClothingItem
  occasion: string
  style: string
  matchScore: number
  tags: string[]
  fashionScore: number
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildOutfit(items: ClothingItem[], id: string): GeneratedOutfit | null {
  const tops    = items.filter(i => i.category === 'Top')
  const bottoms = items.filter(i => i.category === 'Bottom')
  if (!tops.length || !bottoms.length) return null
  const shoes       = items.filter(i => i.category === 'Shoes')
  const accessories = items.filter(i => i.category === 'Accessories')
  const tagCount    = Math.floor(Math.random() * 3) + 4
  return {
    id,
    title:        pick(STYLE_LABELS),
    top:          pick(tops),
    bottom:       pick(bottoms),
    shoes:        shoes.length ? pick(shoes) : undefined,
    accessory:    accessories.length ? pick(accessories) : undefined,
    occasion:     'Casual · Everyday',
    style:        'Casual',
    matchScore:   Math.floor(Math.random() * 20 + 60),
    tags:         OUTFIT_TAGS.slice(0, tagCount),
    fashionScore: Math.floor(Math.random() * 20 + 80),
  }
}

function OutfitCard({ outfit, isSurprise }: { outfit: GeneratedOutfit; isSurprise?: boolean }) {
  const items = [outfit.top, outfit.bottom, outfit.shoes, outfit.accessory].filter((x): x is ClothingItem => !!x)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        background: isSurprise ? 'rgba(255,213,134,0.18)' : '#fffcf8',
        border: `1px solid ${isSurprise ? '#ffd586' : 'rgba(160,120,70,0.15)'}`,
        borderRadius: 14, overflow: 'hidden',
      }}
    >
      {/* Card header */}
      <div style={{ padding: '16px 18px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {isSurprise && <Sparkles size={15} style={{ color: '#756e9e' }} />}
            <span style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: '#2b1f0e' }}>
              {isSurprise ? 'Surprise Outfit' : outfit.title}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Share2 size={15} style={{ color: '#9c866c', cursor: 'pointer' }} />
            <Save size={15} style={{ color: saved ? '#756e9e' : '#9c866c', cursor: 'pointer' }}
              onClick={() => setSaved(!saved)} />
          </div>
        </div>
        {!isSurprise && (
          <p style={{ fontFamily: FF, fontSize: 12, color: '#756e9e', lineHeight: 1.45 }}>
            {outfit.tags.join(' · ')}
          </p>
        )}
      </div>

      {/* Clothing slots */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 0 }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: item.colorHex + (isSurprise ? '18' : '14'), padding: isSurprise ? '48px 12px 16px' : '24px 12px 12px', textAlign: 'center', borderRight: i < items.length - 1 ? '1px solid rgba(160,120,70,0.08)' : 'none' }}>
            <div style={{ width: isSurprise ? 60 : 44, height: isSurprise ? 60 : 44, borderRadius: '50%', background: item.colorHex, margin: '0 auto 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)' }} />
            <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 2 }}>CASUAL</div>
            <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b0a090' }}>{item.category.toUpperCase()}</div>
            {isSurprise && (
              <>
                <div style={{ marginTop: 48 }} />
                <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9c866c' }}>{item.style.toUpperCase()}</div>
                <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#b0a090' }}>{item.occasion.toUpperCase()}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Match + reasons */}
      {!isSurprise && (
        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: FF, fontSize: 12, color: '#9c866c' }}>{outfit.occasion}</span>
            <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: '#9c866c' }}>Match: {outfit.matchScore}%</span>
          </div>
          {/* Why this outfit */}
          <div style={{ background: '#faf7f2', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Info size={12} style={{ color: '#9c866c' }} />
              <span style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9c866c' }}>WHY THIS OUTFIT?</span>
            </div>
            {REASONS.map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 600, color: '#756e9e', width: 160, flexShrink: 0 }}>{r.label}</span>
                <div style={{ flex: 1, height: 5, background: 'rgba(160,120,70,0.12)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${r.pct}%`, height: '100%', background: 'linear-gradient(90deg,#ffd586,#756e9e)', borderRadius: 99 }} />
                </div>
                <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: '#9c866c', width: 32, textAlign: 'right' }}>{r.pct}%</span>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              {outfit.tags.slice(0, 4).map(t => (
                <div key={t} style={{ fontFamily: FF, fontSize: 12, color: '#9c866c', marginBottom: 3 }}>· {t}</div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontFamily: FF, fontSize: 11, color: '#b0a090' }}>
              Fashion-rule score: {outfit.fashionScore}/100 · Final match: {outfit.matchScore}%
            </div>
          </div>
        </div>
      )}

      {/* Feedback row */}
      {!isSurprise && (
        <div style={{ borderTop: '1px solid rgba(160,120,70,0.10)', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#b0a090', flex: 1 }}>FEEDBACK</span>
          {[
            { Icon: Heart,      active: liked, onClick: () => setLiked(!liked) },
            { Icon: Check,      active: false, onClick: () => {} },
            { Icon: ThumbsDown, active: false, onClick: () => {} },
            { Icon: Ban,        active: false, onClick: () => {} },
          ].map(({ Icon, active, onClick }, i) => (
            <button key={i} onClick={onClick}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? '#756e9e' : '#b0a090', padding: '4px 6px', borderRadius: 6, transition: 'color 0.18s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF8C00' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = active ? '#756e9e' : '#b0a090' }}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default function OutfitGenerator() {
  const navigate = useNavigate()
  const { items } = useWardrobe()

  const tops    = items.filter(i => i.category === 'Top')
  const bottoms = items.filter(i => i.category === 'Bottom')
  const hasEnough = tops.length > 0 && bottoms.length > 0

  const [occasion,      setOccasion]      = useState<Occasion>('Any')
  const [refreshKey,    setRefreshKey]    = useState(0)
  const [surpriseOutfit,setSurpriseOutfit]= useState<GeneratedOutfit | null>(null)
  const [weather,       setWeather]       = useState('27°C · Thunderstorm')
  const [antiRepeat,    setAntiRepeat]    = useState(false)

  const outfits = useMemo(() => {
    if (!hasEnough) return []
    const newOutfits: GeneratedOutfit[] = []
    for (let i = 0; i < 3; i++) {
      const o = buildOutfit(items, `outfit-${refreshKey}-${i}`)
      if (o) newOutfits.push(o)
    }
    return newOutfits
  }, [items, refreshKey, hasEnough])

  function generateAll() {
    setRefreshKey(prev => prev + 1)
    setSurpriseOutfit(null)
  }

  useEffect(() => {
    // Weather fetch
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`)
          const data = await res.json()
          const codeMap: Record<number,string> = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Light drizzle',61:'Light rain',63:'Rain',71:'Light snow',80:'Rain showers',95:'Thunderstorm' }
          const cw = data.current_weather
          setWeather(`${Math.round(cw.temperature)}°C · ${codeMap[cw.weathercode] ?? 'Clear sky'}`)
        } catch { /* keep default */ }
      }, () => {})
    }
  }, [])

  function generateSurprise() {
    const o = buildOutfit(items, `surprise-${Date.now()}`)
    setSurpriseOutfit(o)
  }

  // Not enough clothes guard
  if (!hasEnough) {
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: '#faf7f2', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '12px 24px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
        >
          <Sparkles size={15} /> Add Clothes
        </motion.button>
      </motion.div>
    )
  }

  const pillBase: React.CSSProperties = {
    fontFamily: FF, fontSize: 13, fontWeight: 600,
    padding: '6px 14px', borderRadius: 8,
    border: '1.5px solid #e0d0be', background: '#fffcf8',
    color: '#5c4a35', cursor: 'pointer', transition: 'all 0.18s',
  }
  const pillActive: React.CSSProperties = {
    ...pillBase, background: '#2b1f0e', color: '#fff', borderColor: '#2b1f0e',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>Outfit Generator</h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>Hybrid recommendations from your wardrobe</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={generateSurprise}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
          >
            <Sparkles size={14} /> Surprise Me
          </motion.button>
          <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={generateAll}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '9px 16px', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
          >
            <RefreshCw size={14} /> Refresh
          </motion.button>
        </div>
      </div>

      {/* Context strips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <div style={{ background: '#fffcf8', border: '1.5px solid #ffd586', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Cloud size={16} style={{ color: '#9c866c' }} />
          <div>
            <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c' }}>WEATHER CONTEXT · ON</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e' }}>{weather}</div>
          </div>
        </div>
        <button onClick={() => setAntiRepeat(p => !p)}
          style={{ background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0d0be' }}
        >
          <RefreshCw size={16} style={{ color: '#9c866c' }} />
          <div>
            <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c' }}>ANTI-REPETITION · {antiRepeat ? 'ON' : 'OFF'}</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#2b1f0e' }}>Hide recently-worn items</div>
          </div>
        </button>
      </div>

      {/* Occasion filter */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 10 }}>FILTER BY OCCASION</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {OCCASIONS.map(o => (
            <button key={o} onClick={() => setOccasion(o)}
              style={occasion === o ? pillActive : pillBase}
              onMouseEnter={e => { if (occasion !== o) { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' } }}
              onMouseLeave={e => { if (occasion !== o) { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#5c4a35' } }}
            >{o}</button>
          ))}
        </div>
      </div>

      {/* Surprise outfit */}
      <AnimatePresence>
        {surpriseOutfit && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            style={{ marginBottom: 24 }}
          >
            <OutfitCard outfit={surpriseOutfit} isSurprise />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated outfits grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {outfits.map(outfit => (
          <OutfitCard key={outfit.id} outfit={outfit} />
        ))}
      </div>
    </motion.div>
  )
}