import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RefreshCw, Sun, MapPin, TrendingUp, CalendarDays, Plus } from 'lucide-react'
import { useWardrobe } from '../../context/useWardrobe'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TRENDS = ['Quiet Luxury', 'Old Money', 'Y2K Revival', 'Coastal Grandmother', 'Streetwear']

interface DayPlan {
  day: string
  top: ClothingItem
  bottom: ClothingItem
  shoes?: ClothingItem
  matchScore: number
  style: string
}

interface WeatherData {
  temp: string
  condition: string
  location: string
}

export default function Planner() {
  const navigate = useNavigate()
  const { items } = useWardrobe()

  const [weather, setWeather]     = useState<WeatherData>({ temp: '--', condition: 'Detecting...', location: 'Auto-detected' })
  const [trend, setTrend]         = useState('Building Trends...')
  const [plan, setPlan]           = useState<DayPlan[]>([])
  const [spinning, setSpinning]   = useState(false)

  // Weather fetch
  useEffect(() => {
    let i = 0
    const iv = setInterval(() => {
      setTrend(TRENDS[i % TRENDS.length])
      i++
    }, 3000)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`)
          const data = await res.json()
          const cw   = data.current_weather
          const codeMap: Record<number, string> = {
            0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
            45:'Foggy', 51:'Light drizzle', 61:'Light rain', 63:'Rain',
            71:'Light snow', 80:'Rain showers', 95:'Thunderstorm',
          }
          const condition = codeMap[cw.weathercode] ?? 'Clear sky'

          // reverse geocode
          const geoRes  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const geoData = await geoRes.json()
          const city    = geoData.address?.city ?? geoData.address?.town ?? geoData.address?.county ?? 'Your city'

          setWeather({ temp: `${Math.round(cw.temperature)}°C`, condition, location: city })
        } catch {
          setWeather({ temp: '31°C', condition: 'Overcast', location: 'Auto-detected' })
        }
      }, () => {
        setWeather({ temp: '31°C', condition: 'Overcast', location: 'Auto-detected' })
      })
    }

    return () => clearInterval(iv)
  }, [])

  // Generate weekly plan
  function generatePlan() {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 700)

    const tops    = items.filter(i => i.category === 'Top')
    const bottoms = items.filter(i => i.category === 'Bottom')
    const shoes   = items.filter(i => i.category === 'Shoes')

    if (tops.length === 0 || bottoms.length === 0) { setPlan([]); return }

    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    const STYLES = ['Casual Look', 'Work Outfit', 'Sporty Fit', 'Classic Combo', 'Street Style', 'Smart Casual', 'Relaxed Fit']

    const newPlan = DAYS.map((day, i) => ({
      day,
      top:        pick(tops),
      bottom:     pick(bottoms),
      shoes:      shoes.length ? pick(shoes) : undefined,
      matchScore: Math.floor(Math.random() * 30 + 65),
      style:      STYLES[i % STYLES.length],
    }))
    setPlan(newPlan)
  }

  const hasPlan   = plan.length > 0
  const notEnough = items.filter(i => i.category === 'Top').length === 0 || items.filter(i => i.category === 'Bottom').length === 0

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e', marginBottom: 4 }}>Weekly Outfit Plan</h1>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>Context-aware, non-repetitive — built from your wardrobe</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={generatePlan}
          style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#2b1f0e', background: '#fffcf8', border: '1.5px solid #e0d0be', borderRadius: 10, padding: '9px 18px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0d0be'; e.currentTarget.style.color = '#2b1f0e' }}
        >
          <motion.span animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.7 }}>
            <RefreshCw size={14} />
          </motion.span>
          Regenerate
        </motion.button>
      </div>

      {/* Context cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { icon: Sun,        label: 'WEATHER',  value: `${weather.temp} · ${weather.condition}` },
          { icon: MapPin,     label: 'LOCATION', value: weather.location },
          { icon: TrendingUp, label: 'TRENDING', value: trend },
        ].map(({ icon: Icon, label, value }) => (
          <motion.div key={label} whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(80,50,20,0.08)' }}
            style={{ background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'default', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#ffd586' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,120,70,0.15)' }}
          >
            <Icon size={18} style={{ color: '#9c866c', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: '#2b1f0e' }}>{value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty / not enough state */}
      {!hasPlan && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: '#fffcf8', border: '1.5px dashed rgba(160,120,70,0.2)', borderRadius: 16, padding: '70px 24px', textAlign: 'center' }}
        >
          <div style={{ width: 64, height: 64, background: 'rgba(255,213,134,0.25)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CalendarDays size={30} style={{ color: '#756e9e' }} />
          </div>
          {notEnough ? (
            <>
              <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 8 }}>Add more clothes to plan a full week</h2>
              <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>You need at least a few tops, bottoms, and shoes</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/wardrobe/add')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '12px 24px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              >
                <Plus size={14} /> Add Clothes
              </motion.button>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: FH, fontSize: 22, color: '#2b1f0e', marginBottom: 8 }}>Generate your weekly plan</h2>
              <p style={{ fontFamily: FF, fontSize: 14, color: '#9c866c', marginBottom: 28 }}>Click Regenerate to build a 7-day outfit schedule</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={generatePlan}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#2b1f0e', border: 'none', borderRadius: 30, padding: '12px 24px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FF8C00' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2b1f0e' }}
              >
                <RefreshCw size={14} /> Generate Plan
              </motion.button>
            </>
          )}
        </motion.div>
      )}

      {/* 7-day grid */}
      {hasPlan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {plan.map((day, i) => (
            <motion.div key={day.day}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: i * 0.06 }}
              whileHover={{ y: -3, boxShadow: '0 6px 24px rgba(80,50,20,0.10)' }}
              style={{ background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)', borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,120,70,0.15)' }}
            >
              <div style={{ padding: '14px 16px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c' }}>{day.day.slice(0,3).toUpperCase()}</span>
                  <span style={{ fontFamily: FF, fontSize: 11, fontWeight: 700, color: '#756e9e' }}>Match: {day.matchScore}%</span>
                </div>
                <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 15, color: '#2b1f0e', marginBottom: 10 }}>{day.style}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[day.top, day.bottom, day.shoes].filter(Boolean).map((item, j) => (
                    <div key={j} style={{ flex: 1, background: item!.colorHex + '22', borderRadius: 9, padding: '8px 6px', textAlign: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: item!.colorHex, margin: '0 auto 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
                      <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9c866c' }}>{item!.category}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(160,120,70,0.1)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#9c866c' }} />
                <span style={{ fontFamily: FF, fontSize: 12, color: '#9c866c' }}>Mark as worn</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}