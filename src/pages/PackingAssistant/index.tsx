import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Luggage, MapPin, CalendarDays, Sun, Cloud, CloudRain,
  Thermometer, Shirt, Footprints, Package, Watch, Layers,
  Sparkles, Check, Plus,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'

type WeatherType = 'warm' | 'mild' | 'cold' | 'rainy'

interface PackItem { id: string; label: string; qty: number; icon: React.ElementType; packed: boolean }
interface PackSection { title: string; icon: React.ElementType; items: PackItem[] }
interface WeatherInfo { temp: string; condition: string; high: string; low: string; rain: string; summary: string }

const WEATHER_OPTIONS: { value: WeatherType; label: string; Icon: React.ElementType }[] = [
  { value: 'warm',  label: 'Warm',  Icon: Sun        },
  { value: 'mild',  label: 'Mild',  Icon: Cloud      },
  { value: 'cold',  label: 'Cold',  Icon: Thermometer },
  { value: 'rainy', label: 'Rainy', Icon: CloudRain  },
]

const WEATHER_INFO: Record<WeatherType, WeatherInfo> = {
  warm:  { temp: '28–34°C', condition: 'Sunny',    high: '34°C', low: '24°C', rain: '5%',  summary: 'Hot and sunny days expected. Light, breathable clothes are ideal.' },
  mild:  { temp: '18–24°C', condition: 'Overcast', high: '24°C', low: '16°C', rain: '20%', summary: 'Comfortable mild weather. A light jacket for evenings is recommended.' },
  cold:  { temp: '2–10°C',  condition: 'Cloudy',   high: '10°C', low: '2°C',  rain: '15%', summary: 'Cold temperatures expected. Pack layers and warm outerwear.' },
  rainy: { temp: '18–22°C', condition: 'Rainy',    high: '22°C', low: '15°C', rain: '80%', summary: 'Frequent rain during your stay. A waterproof jacket and umbrella are essential.' },
}

const TIPS: Record<WeatherType, string[]> = {
  warm:  ['High UV levels expected — bring sunscreen (SPF 50+) and a hat.', 'Stay hydrated; pack a reusable water bottle.', 'Light-coloured, breathable fabrics will keep you cool.'],
  mild:  ['Temperatures may drop in the evening — bring an extra layer.', 'A light rain jacket doubles as a windbreaker.', 'Layering is key for mild, unpredictable weather.'],
  cold:  ['Thermal underlayers make a huge difference in cold climates.', 'Waterproof boots protect against slush and wet ground.', 'Gloves and a beanie are small but essential additions.'],
  rainy: ['Expect frequent rain — pack a lightweight rain jacket.', 'Waterproof shoes will keep your feet dry all day.', 'An umbrella is non-negotiable for this destination.'],
}

function buildPackList(weather: WeatherType, days: number): PackSection[] {
  const d = Math.max(1, days)
  const clothing: PackItem[] = [
    { id: 'tshirts',   label: 'T-shirts',        qty: Math.min(d, 7),             icon: Shirt,    packed: false },
    { id: 'bottoms',   label: 'Pants / Bottoms',  qty: Math.round(d / 2),          icon: Shirt,    packed: false },
    { id: 'underwear', label: 'Underwear',         qty: d + 1,                      icon: Shirt,    packed: false },
    { id: 'socks',     label: 'Socks',             qty: d + 1,                      icon: Shirt,    packed: false },
    { id: 'pajamas',   label: 'Pajamas',           qty: Math.max(1, Math.round(d / 3)), icon: Shirt, packed: false },
  ]
  if (weather === 'cold')  { clothing.push({ id: 'sweater', label: 'Sweater / Hoodie', qty: 2, icon: Shirt, packed: false }) }
  if (weather === 'rainy') { clothing.push({ id: 'raincoat', label: 'Rain jacket', qty: 1, icon: Shirt, packed: false }) }
  const footwear: PackItem[] = [{ id: 'shoes', label: 'Shoes', qty: weather === 'rainy' ? 1 : 2, icon: Footprints, packed: false }]
  if (weather === 'warm')  footwear.push({ id: 'sandals',     label: 'Sandals',          qty: 1, icon: Footprints, packed: false })
  if (weather === 'rainy') footwear.push({ id: 'waterproof', label: 'Waterproof shoes', qty: 1, icon: Footprints, packed: false })
  const outerwear: PackItem[] = []
  if (weather === 'mild' || weather === 'cold') outerwear.push({ id: 'jacket', label: weather === 'cold' ? 'Winter coat' : 'Light jacket', qty: 1, icon: Layers, packed: false })
  if (weather === 'cold') { outerwear.push({ id: 'scarf', label: 'Scarf', qty: 1, icon: Layers, packed: false }); outerwear.push({ id: 'gloves', label: 'Gloves', qty: 1, icon: Layers, packed: false }) }
  const essentials: PackItem[] = [
    { id: 'toiletries', label: 'Toothbrush & toiletries kit', qty: 1, icon: Package,   packed: false },
    { id: 'charger',    label: 'Phone charger',               qty: 1, icon: Package,   packed: false },
    { id: 'docs',       label: 'Travel documents',            qty: 1, icon: Package,   packed: false },
    { id: 'meds',       label: 'Medications / First aid',     qty: 1, icon: Package,   packed: false },
  ]
  if (weather === 'rainy') essentials.push({ id: 'umbrella', label: 'Umbrella', qty: 1, icon: CloudRain, packed: false })
  const accessories: PackItem[] = [
    { id: 'sunglasses', label: 'Sunglasses',      qty: 1, icon: Watch,   packed: false },
    { id: 'bag',        label: 'Backpack / day bag', qty: 1, icon: Package, packed: false },
  ]
  if (weather === 'warm')  accessories.push({ id: 'hat',    label: 'Hat / Cap', qty: 1, icon: Watch, packed: false })
  if (weather === 'cold')  accessories.push({ id: 'beanie', label: 'Beanie',    qty: 1, icon: Watch, packed: false })
  const sections: PackSection[] = [
    { title: 'Clothing',    icon: Shirt,      items: clothing    },
    { title: 'Footwear',    icon: Footprints, items: footwear    },
    { title: 'Essentials',  icon: Package,    items: essentials  },
    { title: 'Accessories', icon: Watch,      items: accessories },
  ]
  if (outerwear.length > 0) sections.push({ title: 'Outerwear', icon: Layers, items: outerwear })
  return sections
}

function PackRow({ item, onToggle }: { item: PackItem; onToggle: () => void }) {
  const Icon = item.icon
  return (
    <motion.div layout onClick={onToggle} whileHover={{ x: 3 }} transition={{ duration: 0.15 }}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
    >
      <div style={{
        width: 23, height: 23, borderRadius: '50%', flexShrink: 0,
        border: item.packed ? 'none' : '2px solid var(--border-solid)',
        background: item.packed ? 'var(--accent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
      }}>
        {item.packed && <Check size={12} style={{ color: '#fff' }} strokeWidth={3} />}
      </div>
      <Icon size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} strokeWidth={1.6} />
      <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: item.packed ? 'var(--text-muted)' : 'var(--text-body)', textDecoration: item.packed ? 'line-through' : 'none', flex: 1, transition: 'all 0.2s' }}>
        {item.label}
      </span>
      <span style={{ fontFamily: FF, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-alt)', borderRadius: 99, padding: '2px 9px' }}>
        ×{item.qty}
      </span>
    </motion.div>
  )
}

function SectionCard({ section, onToggle }: { section: PackSection; onToggle: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}
      whileHover={{ boxShadow: 'var(--shadow-md)' }}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 15, padding: '21px 23px', transition: 'border-color 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17.5, color: 'var(--text-heading)', marginBottom: 5 }}>{section.title}</div>
      {section.items.map(item => <PackRow key={item.id} item={item} onToggle={() => onToggle(item.id)} />)}
    </motion.div>
  )
}

export default function PackingAssistant() {
  const navigate = useNavigate()
  const [destination, setDestination] = useState('')
  const [days,        setDays]        = useState(5)
  const [weather,     setWeather]     = useState<WeatherType>('mild')
  const [sections,    setSections]    = useState<PackSection[]>([])
  const [generated,   setGenerated]   = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [weatherInfo, setWeatherInfo] = useState<WeatherInfo | null>(null)

  function totalItems()  { return sections.reduce((a, s) => a + s.items.length, 0) }
  function packedItems() { return sections.reduce((a, s) => a + s.items.filter(i => i.packed).length, 0) }

  function toggleItem(sectionTitle: string, itemId: string) {
    setSections(prev => prev.map(s =>
      s.title === sectionTitle ? { ...s, items: s.items.map(i => i.id === itemId ? { ...i, packed: !i.packed } : i) } : s
    ))
  }

  async function generate() {
    if (!destination.trim()) return
    setLoading(true)
    try {
      const geoRes  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`)
      const geoData = await geoRes.json()
      if (geoData.length > 0) {
        const { lat, lon } = geoData[0]
        const wRes  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&current_weather=true&temperature_unit=celsius&timezone=auto&forecast_days=${Math.min(days, 7)}`)
        const wData = await wRes.json()
        const cw     = wData.current_weather
        const maxT   = Math.round(Math.max(...wData.daily.temperature_2m_max))
        const minT   = Math.round(Math.min(...wData.daily.temperature_2m_min))
        const rainPct= Math.round(Math.max(...wData.daily.precipitation_probability_max))
        const codeMap: Record<number, string> = { 0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',51:'Light drizzle',61:'Light rain',63:'Rain',71:'Light snow',80:'Rain showers',95:'Thunderstorm' }
        const condition = codeMap[cw.weathercode] ?? 'Clear sky'
        let detected: WeatherType = 'mild'
        if (rainPct > 50) detected = 'rainy'
        else if (maxT >= 28) detected = 'warm'
        else if (maxT <= 12) detected = 'cold'
        setWeather(detected)
        setWeatherInfo({ temp: `${minT}–${maxT}°C`, condition, high: `${maxT}°C`, low: `${minT}°C`, rain: `${rainPct}%`, summary: WEATHER_INFO[detected].summary })
        setSections(buildPackList(detected, days))
      } else {
        setWeatherInfo(WEATHER_INFO[weather]); setSections(buildPackList(weather, days))
      }
    } catch {
      setWeatherInfo(WEATHER_INFO[weather]); setSections(buildPackList(weather, days))
    }
    setLoading(false); setGenerated(true)
  }

  const pillBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    fontFamily: FF, fontSize: 13.5, fontWeight: 600,
    padding: '6px 14px', borderRadius: 30, cursor: 'pointer',
    border: '1.5px solid var(--border-solid)', background: 'var(--bg-card)', color: 'var(--text-body)', transition: 'all 0.18s',
  }
  const pillActive: React.CSSProperties = {
    ...pillBase, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 7 }}>
          <Luggage size={30} style={{ color: 'var(--accent)' }} />
          <h1 className="page-title-lg">Packing Assistant</h1>
        </div>
        <p className="page-subtitle" style={{ marginBottom: 30 }}>Build a smart packing list tailored to your trip.</p>

        {/* Input card */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 18, padding: '26px 28px', marginBottom: 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 22, marginBottom: 22 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
                <MapPin size={12} /> DESTINATION
              </div>
              <input value={destination} onChange={e => setDestination(e.target.value)} onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="Tokyo, Paris..."
                style={{ width: '100%', height: 44, border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '0 15px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
                <CalendarDays size={12} /> DAYS
              </div>
              <input type="number" min={1} max={30} value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '100%', height: 44, border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '0 15px', fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 9 }}>
                <Cloud size={12} /> EXPECTED WEATHER
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {WEATHER_OPTIONS.map(({ value, label, Icon }) => (
                  <button key={value} onClick={() => setWeather(value)} style={weather === value ? pillActive : pillBase}
                    onMouseEnter={e => { if (weather !== value) { e.currentTarget.style.borderColor = 'var(--secondary)'; e.currentTarget.style.color = 'var(--accent)' } }}
                    onMouseLeave={e => { if (weather !== value) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
                  ><Icon size={13} /> {label}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <motion.button whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={generate} disabled={loading || !destination.trim()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: '#fff', background: loading ? 'var(--text-muted)' : 'var(--accent)', border: 'none', borderRadius: 30, padding: '12px 24px', cursor: loading ? 'wait' : 'pointer', opacity: !destination.trim() ? 0.6 : 1 }}
              onMouseEnter={e => { if (!loading && destination.trim()) e.currentTarget.style.background = 'var(--accent-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = loading ? 'var(--text-muted)' : 'var(--accent)' }}
            >
              <Sparkles size={16} />{loading ? 'Fetching forecast…' : 'Generate Packing List'}
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {generated && sections.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
              {/* Weather strip */}
              {weatherInfo && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', marginBottom: 26, display: 'flex', gap: 26, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  {[
                    { Icon: Sun,         label: 'CONDITION',    value: weatherInfo.condition },
                    { Icon: Thermometer, label: 'TEMPERATURE',  value: weatherInfo.temp      },
                    { Icon: CloudRain,   label: 'RAIN CHANCE',  value: weatherInfo.rain      },
                  ].map(({ Icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Icon size={19} style={{ color: 'var(--accent)' }} />
                      <div>
                        <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontFamily: FF, fontSize: 15, fontWeight: 700, color: 'var(--text-heading)' }}>{value}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ flex: 1, fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{weatherInfo.summary}</div>
                </motion.div>
              )}

              {/* List header */}
              <div style={{ marginBottom: 22 }}>
                <h2 className="page-title" style={{ fontSize: 28 }}>Your Packing List</h2>
                <p className="page-subtitle">{days} day{days !== 1 ? 's' : ''} · {weather} weather · {packedItems()}/{totalItems()} packed</p>
              </div>

              <div className="ss-grid-2" style={{ marginBottom: 28 }}>
                {sections.map(section => (
                  <SectionCard key={section.title} section={section}
                    onToggle={itemId => toggleItem(section.title, itemId)}
                  />
                ))}
              </div>

              {/* Tips */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.2 }}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 15, padding: '22px 24px', marginBottom: 22 }}
              >
                <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: 'var(--text-heading)', marginBottom: 16 }}>✈️ Smart Travel Tips</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {TIPS[weather].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 7 }} />
                      <span style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-body)', lineHeight: 1.55 }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* CTA */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ background: 'var(--secondary-soft)', border: '1.5px dashed var(--secondary)', borderRadius: 15, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}
              >
                <div>
                  <div style={{ fontFamily: FF, fontWeight: 700, fontSize: 15, color: 'var(--text-heading)', marginBottom: 3 }}>Recommended From Your Wardrobe</div>
                  <div style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)' }}>Your wardrobe doesn't have enough suitable items for this trip.</div>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/wardrobe/add')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 11, padding: '11px 20px', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent)' }}
                ><Plus size={15} /> Add Clothes</motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}