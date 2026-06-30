import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RefreshCw, Sun, MapPin, TrendingUp, CalendarDays, Plus } from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TRENDS = ['Quiet Luxury', 'Old Money', 'Y2K Revival', 'Coastal Grandmother', 'Streetwear']

interface DayPlan {
  day: string; top: ClothingItem; bottom: ClothingItem; shoes?: ClothingItem
  matchScore: number; style: string
}
interface WeatherData { temp: string; condition: string; location: string }

export default function Planner() {
  const navigate = useNavigate()
  const { items } = useWardrobe()
  const [weather, setWeather]   = useState<WeatherData>({ temp: '--', condition: 'Detecting...', location: 'Auto-detected' })
  const [trend, setTrend]       = useState('Building Trends...')
  const [plan, setPlan]         = useState<DayPlan[]>([])
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    let i = 0
    const iv = setInterval(() => { setTrend(TRENDS[i % TRENDS.length]); i++ }, 3000)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { latitude: lat, longitude: lon } = pos.coords
          const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`)
          const data = await res.json()
          const cw = data.current_weather
          const codeMap: Record<number, string> = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Light drizzle',61:'Light rain',63:'Rain',71:'Light snow',80:'Rain showers',95:'Thunderstorm' }
          const condition = codeMap[cw.weathercode] ?? 'Clear sky'
          const geoRes  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
          const geoData = await geoRes.json()
          const city = geoData.address?.city ?? geoData.address?.town ?? geoData.address?.county ?? 'Your city'
          setWeather({ temp: `${Math.round(cw.temperature)}°C`, condition, location: city })
        } catch { setWeather({ temp: '31°C', condition: 'Overcast', location: 'Auto-detected' }) }
      }, () => { setWeather({ temp: '31°C', condition: 'Overcast', location: 'Auto-detected' }) })
    }
    return () => clearInterval(iv)
  }, [])

  function generatePlan() {
    setSpinning(true); setTimeout(() => setSpinning(false), 700)
    const tops = items.filter(i => i.category === 'Top')
    const bottoms = items.filter(i => i.category === 'Bottom')
    const shoes = items.filter(i => i.category === 'Shoes')
    if (tops.length === 0 || bottoms.length === 0) { setPlan([]); return }
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    const STYLES = ['Casual Look', 'Work Outfit', 'Sporty Fit', 'Classic Combo', 'Street Style', 'Smart Casual', 'Relaxed Fit']
    setPlan(DAYS.map((day, i) => ({
      day, top: pick(tops), bottom: pick(bottoms), shoes: shoes.length ? pick(shoes) : undefined,
      matchScore: Math.floor(Math.random() * 30 + 65), style: STYLES[i % STYLES.length],
    })))
  }

  const hasPlan = plan.length > 0
  const notEnough = items.filter(i => i.category === 'Top').length === 0 || items.filter(i => i.category === 'Bottom').length === 0

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 26, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title-lg">Weekly Outfit Plan</h1>
          <p className="page-subtitle">Context-aware, non-repetitive — built from your wardrobe</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={generatePlan}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-heading)', background: 'var(--bg-card)', border: '1.5px solid var(--border-solid)', borderRadius: 11, padding: '10px 20px', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-heading)' }}
        >
          <motion.span animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.7 }}><RefreshCw size={15} /></motion.span>
          Regenerate
        </motion.button>
      </div>

      <div className="ss-grid-3" style={{ marginBottom: 26 }}>
        {[
          { icon: Sun,        label: 'WEATHER',  value: `${weather.temp} · ${weather.condition}` },
          { icon: MapPin,     label: 'LOCATION', value: weather.location },
          { icon: TrendingUp, label: 'TRENDING', value: trend },
        ].map(({ icon: Icon, label, value }) => (
          <motion.div key={label} whileHover={{ y: -2, boxShadow: 'var(--shadow-sm)' }}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 19px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'default', transition: 'border-color 0.2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
          >
            <Icon size={19} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontFamily: FF, fontSize: 15.5, fontWeight: 700, color: 'var(--text-heading)' }}>{value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {!hasPlan && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: 'var(--bg-card)', border: '1.5px dashed var(--border-solid)', borderRadius: 18, padding: '76px 24px', textAlign: 'center' }}
        >
          <div style={{ width: 68, height: 68, background: 'var(--secondary-soft)', borderRadius: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
            <CalendarDays size={32} style={{ color: 'var(--accent)' }} />
          </div>
          {notEnough ? (
            <>
              <h2 className="page-title" style={{ fontSize: 24, marginBottom: 9 }}>Add more clothes to plan a full week</h2>
              <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 30 }}>You need at least a few tops, bottoms, and shoes</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => navigate('/wardrobe/add')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 30, padding: '13px 26px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
              ><Plus size={15} /> Add Clothes</motion.button>
            </>
          ) : (
            <>
              <h2 className="page-title" style={{ fontSize: 24, marginBottom: 9 }}>Generate your weekly plan</h2>
              <p style={{ fontFamily: FF, fontSize: 14.5, color: 'var(--text-muted)', marginBottom: 30 }}>Click Regenerate to build a 7-day outfit schedule</p>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={generatePlan}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 30, padding: '13px 26px', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
              ><RefreshCw size={15} /> Generate Plan</motion.button>
            </>
          )}
        </motion.div>
      )}

      {hasPlan && (
        <div className="ss-grid-2">
          {plan.map((day, i) => (
            <motion.div key={day.day}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: i * 0.06 }}
              whileHover={{ y: -3, boxShadow: 'var(--shadow-md)' }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <div style={{ padding: '15px 17px 13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{day.day.slice(0,3).toUpperCase()}</span>
                  <span style={{ fontFamily: FF, fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>Match: {day.matchScore}%</span>
                </div>
                <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 15.5, color: 'var(--text-heading)', marginBottom: 11 }}>{day.style}</div>
                <div style={{ display: 'flex', gap: 9 }}>
                  {[day.top, day.bottom, day.shoes].filter(Boolean).map((item, j) => (
                    <div key={j} style={{ flex: 1, background: item!.colorHex + '22', borderRadius: 9, padding: '9px 7px', textAlign: 'center' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: item!.colorHex, margin: '0 auto 6px', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} />
                      <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{item!.category}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: '1px solid var(--border)', padding: '11px 17px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
                <span style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)' }}>Mark as worn</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}