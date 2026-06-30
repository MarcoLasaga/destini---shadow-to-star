import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Luggage, MapPin, CalendarDays, Sun, Cloud,
  Snowflake, CloudRain, Sparkles, Shirt, Footprints,
  Glasses, ShoppingBag, Wind, Check,
} from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// ── Weather types ─────────────────────────────────────────────────────────────
type WeatherType = 'warm' | 'mild' | 'cold' | 'rainy'

const WEATHER_OPTS: { value: WeatherType; label: string; Icon: React.ElementType }[] = [
  { value: 'warm',  label: 'Warm',  Icon: Sun       },
  { value: 'mild',  label: 'Mild',  Icon: Cloud     },
  { value: 'cold',  label: 'Cold',  Icon: Snowflake },
  { value: 'rainy', label: 'Rainy', Icon: CloudRain },
]

// ── Packing item definition ───────────────────────────────────────────────────
interface PackItem {
  id:       string
  label:    string
  qty:      number
  Icon:     React.ElementType
  checked:  boolean
}

interface PackCategory {
  id:    string
  title: string
  items: PackItem[]
}

// ── Weather-based packing logic ───────────────────────────────────────────────
function buildPackingList(weather: WeatherType, days: number): PackCategory[] {
  const d = Math.max(1, days)

  const clothing: PackItem[] = [
    { id: 'tshirts', label: 'T-shirts',      qty: Math.min(d, 5), Icon: Shirt, checked: false },
    { id: 'pants',   label: 'Pants / Bottoms', qty: Math.ceil(d / 2), Icon: Shirt, checked: false },
    { id: 'under',   label: 'Underwear',     qty: d + 1,           Icon: Shirt, checked: false },
    { id: 'socks',   label: 'Socks',         qty: d + 1,           Icon: Shirt, checked: false },
    { id: 'pjs',     label: 'Pajamas',       qty: Math.ceil(d / 3), Icon: Shirt, checked: false },
  ]

  if (weather === 'cold') {
    clothing.push({ id: 'sweater', label: 'Sweater / Hoodie', qty: 2, Icon: Shirt, checked: false })
    clothing.push({ id: 'thermals', label: 'Thermal Layers',  qty: 1, Icon: Shirt, checked: false })
  }
  if (weather === 'rainy') {
    clothing.push({ id: 'rainpants', label: 'Rain-resistant Pants', qty: 1, Icon: Shirt, checked: false })
  }

  const footwear: PackItem[] = [
    { id: 'shoes', label: 'Shoes', qty: weather === 'rainy' ? 2 : 2, Icon: Footprints, checked: false },
  ]
  if (weather === 'warm') {
    footwear.push({ id: 'sandals', label: 'Sandals', qty: 1, Icon: Footprints, checked: false })
  }
  if (weather === 'rainy') {
    footwear.push({ id: 'waterproof', label: 'Waterproof Shoes', qty: 1, Icon: Footprints, checked: false })
  }
  if (weather === 'cold') {
    footwear.push({ id: 'boots', label: 'Warm Boots', qty: 1, Icon: Footprints, checked: false })
  }

  const outerwear: PackItem[] = []
  if (weather === 'mild') {
    outerwear.push({ id: 'lightjacket', label: 'Light jacket', qty: 1, Icon: Shirt, checked: false })
  }
  if (weather === 'cold') {
    outerwear.push({ id: 'coat', label: 'Heavy Coat',  qty: 1, Icon: Shirt, checked: false })
    outerwear.push({ id: 'scarf', label: 'Scarf',      qty: 1, Icon: Shirt, checked: false })
    outerwear.push({ id: 'gloves', label: 'Gloves',    qty: 1, Icon: Shirt, checked: false })
  }
  if (weather === 'rainy') {
    outerwear.push({ id: 'raincoat', label: 'Rain Jacket / Poncho', qty: 1, Icon: Shirt, checked: false })
  }
  if (weather === 'warm') {
    outerwear.push({ id: 'lightlayer', label: 'Light Layer (for A/C)', qty: 1, Icon: Shirt, checked: false })
  }

  const accessories: PackItem[] = []
  if (weather === 'warm' || weather === 'mild') {
    accessories.push({ id: 'sunnies', label: 'Sunglasses', qty: 1, Icon: Glasses, checked: false })
    accessories.push({ id: 'hat',     label: 'Cap / Hat',  qty: 1, Icon: ShoppingBag, checked: false })
  }
  if (weather === 'rainy') {
    accessories.push({ id: 'umbrella', label: 'Umbrella', qty: 1, Icon: CloudRain, checked: false })
    accessories.push({ id: 'extrasocks', label: 'Extra Socks (waterproof)', qty: 2, Icon: Shirt, checked: false })
  }
  if (weather === 'cold') {
    accessories.push({ id: 'beanie', label: 'Beanie / Hat', qty: 1, Icon: ShoppingBag, checked: false })
  }
  accessories.push({ id: 'bag', label: 'Daypack / Backpack', qty: 1, Icon: ShoppingBag, checked: false })

  const essentials: PackItem[] = [
    { id: 'toiletries', label: 'Toothbrush & toiletries kit', qty: 1, Icon: Wind, checked: false },
    { id: 'charger',    label: 'Phone charger & power bank',  qty: 1, Icon: Wind, checked: false },
    { id: 'meds',       label: 'Medications / first aid',     qty: 1, Icon: Wind, checked: false },
  ]
  if (weather === 'warm') {
    essentials.push({ id: 'sunscreen', label: 'Sunscreen SPF 50+', qty: 1, Icon: Wind, checked: false })
  }

  const cats: PackCategory[] = [
    { id: 'clothing',   title: 'Clothing',   items: clothing   },
    { id: 'footwear',   title: 'Footwear',   items: footwear   },
    { id: 'essentials', title: 'Essentials', items: essentials },
    { id: 'accessories',title: 'Accessories',items: accessories},
  ]
  if (outerwear.length > 0) cats.push({ id: 'outerwear', title: 'Outerwear', items: outerwear })

  return cats
}

// ── Travel tips ───────────────────────────────────────────────────────────────
function getTips(weather: WeatherType): string[] {
  const base = ['Pack versatile colours that mix and match easily.', 'Roll clothes instead of folding to save space.']
  const map: Record<WeatherType, string[]> = {
    warm:  ['High UV expected — don\'t forget sunscreen and sunglasses.', 'Lightweight, breathable fabrics are your best friend in the heat.'],
    mild:  ['Temperatures may vary — layer up for cooler evenings.', 'A light jacket is perfect for mild conditions.'],
    cold:  ['Layer up! Thermals under your regular clothes make a big difference.', 'Waterproof boots will keep you comfortable in cold, wet conditions.'],
    rainy: ['Expect frequent rain — pack a lightweight rain jacket.', 'Waterproof bags or dry pouches protect your electronics.'],
  }
  return [...map[weather], ...base]
}

// ── Auto weather via geocoding + Open-Meteo ───────────────────────────────────
async function fetchWeatherForDestination(dest: string): Promise<{ label: string; type: WeatherType; temp: string; condition: string } | null> {
  try {
    const geoRes  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(dest)}&format=json&limit=1`)
    const geoData = await geoRes.json()
    if (!geoData.length) return null
    const { lat, lon } = geoData[0]
    const wRes  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7&timezone=auto`)
    const wData = await wRes.json()
    const cw     = wData.current_weather
    const temp   = Math.round(cw.temperature)
    const avgMax = wData.daily?.temperature_2m_max?.reduce((a: number, b: number) => a + b, 0) / 7 || temp
    const avgRain= wData.daily?.precipitation_sum?.reduce((a: number, b: number) => a + b, 0) || 0

    let type: WeatherType = 'mild'
    if (avgRain > 20)       type = 'rainy'
    else if (avgMax >= 28)  type = 'warm'
    else if (avgMax <= 12)  type = 'cold'

    const codeMap: Record<number, string> = {
      0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Foggy', 51:'Light drizzle', 61:'Light rain', 63:'Rain',
      71:'Light snow', 80:'Showers', 95:'Thunderstorm',
    }
    return { label: WEATHER_OPTS.find(w => w.value === type)!.label, type, temp: `${temp}°C`, condition: codeMap[cw.weathercode] ?? 'Clear sky' }
  } catch { return null }
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PackingAssistant() {
  const [destination, setDestination]   = useState('')
  const [days, setDays]                 = useState(5)
  const [weather, setWeather]           = useState<WeatherType>('mild')
  const [autoWeather, setAutoWeather]   = useState<{ temp: string; condition: string } | null>(null)
  const [fetching, setFetching]         = useState(false)
  const [categories, setCategories]     = useState<PackCategory[]>([])
  const [generated, setGenerated]       = useState(false)
  const [tips, setTips]                 = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Total items / packed count
  const allItems   = categories.flatMap(c => c.items)
  const packedCount= allItems.filter(i => i.checked).length
  const totalCount = allItems.length

  // Toggle item checked
  function toggle(catId: string, itemId: string) {
    setCategories(prev => prev.map(cat =>
      cat.id !== catId ? cat : {
        ...cat,
        items: cat.items.map(it => it.id !== itemId ? it : { ...it, checked: !it.checked }),
      }
    ))
  }

  // Generate
  async function generate() {
    const trimmedDestination = destination.trim()
    setFetching(true)
    setStatusMessage(null)

    let auto = null
    if (trimmedDestination) {
      auto = await fetchWeatherForDestination(trimmedDestination)
    }

    if (auto) {
      setWeather(auto.type)
      setAutoWeather({ temp: auto.temp, condition: auto.condition })
      setStatusMessage(`Forecast for ${trimmedDestination} loaded.`)
    } else if (trimmedDestination) {
      setAutoWeather(null)
      setStatusMessage('Weather lookup was unavailable, so the list uses your selected weather.')
    }

    const wt = auto?.type ?? weather
    setCategories(buildPackingList(wt, days))
    setTips(getTips(wt))
    setGenerated(true)
    setFetching(false)
    requestAnimationFrame(() => document.getElementById('packing-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 44,
    border: '1.5px solid var(--border-solid)',
    borderRadius: 9, padding: '0 14px',
    fontFamily: FF, fontSize: 14,
    color: 'var(--text-body)', background: 'var(--bg-input)', outline: 'none',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: 'var(--bg-page)', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <Luggage size={28} style={{ color: 'var(--accent-hover)' }} />
          <h1 style={{ fontFamily: FH, fontSize: 30, color: 'var(--text-heading)' }}>Packing Assistant</h1>
        </div>
        <p style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 28 }}>
          Build a smart packing list tailored to your trip.
        </p>

        {/* ── Input card ── */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '24px 28px', marginBottom: 36,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 20, marginBottom: 20 }}>

            {/* Destination */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                <MapPin size={12} /> DESTINATION
              </div>
              <input
                value={destination}
                onChange={e => setDestination(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generate()}
                placeholder="Tokyo, Paris…"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Days */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                <CalendarDays size={12} /> DAYS
              </div>
              <input
                type="number" min={1} max={30}
                value={days}
                onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = '#ffd586'; e.target.style.boxShadow = '0 0 0 3px rgba(255,213,134,0.2)' }}
                onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Expected weather (auto + manual override) */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                <Cloud size={12} /> EXPECTED WEATHER
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {WEATHER_OPTS.map(({ value, label, Icon }) => {
                  const active = weather === value
                  return (
                    <button key={value} onClick={() => setWeather(value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontFamily: FF, fontSize: 13, fontWeight: 600,
                        padding: '6px 13px', borderRadius: 30, cursor: 'pointer',
                        border: active ? 'none' : '1.5px solid var(--border-solid)',
                        background: active ? '#e07020' : 'var(--bg-card)',
                        color: active ? '#fff' : 'var(--text-body)',
                        transition: 'all 0.18s',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = '#FF8C00'; e.currentTarget.style.color = '#FF8C00' } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'var(--border-solid)'; e.currentTarget.style.color = 'var(--text-body)' } }}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  )
                })}
              </div>
              {autoWeather && (
                <p style={{ fontFamily: FF, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>
                  Auto-detected: {autoWeather.temp} · {autoWeather.condition}
                </p>
              )}
            </div>
          </div>

          {/* Generate button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            {statusMessage && (
              <p style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                {statusMessage}
              </p>
            )}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.97 }}
              onClick={generate}
              disabled={fetching}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: FF, fontSize: 14, fontWeight: 700,
                color: '#fff',
                background: fetching ? '#9c866c' : '#2b1f0e',
                border: 'none', borderRadius: 30,
                padding: '12px 24px', cursor: fetching ? 'wait' : 'pointer',
              }}
              onMouseEnter={e => { if (!fetching) e.currentTarget.style.background = '#FF8C00' }}
              onMouseLeave={e => { if (!fetching) e.currentTarget.style.background = '#2b1f0e' }}
            >
              <Sparkles size={15} />
              {fetching ? 'Detecting weather…' : 'Generate Packing List'}
            </motion.button>
          </div>
        </div>

        {/* ── Packing list ── */}
        <AnimatePresence>
          {generated && (
            <motion.div id="packing-list"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            >
              {/* Summary header */}
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: FH, fontSize: 26, color: 'var(--text-heading)', marginBottom: 4 }}>
                  Your Packing List
                </h2>
                <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>
                  {days} day{days !== 1 ? 's' : ''} · {WEATHER_OPTS.find(w => w.value === weather)?.label.toLowerCase()} weather · {packedCount}/{totalCount} packed
                </p>
              </div>

              {/* Category grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                {categories.map((cat, ci) => (
                  <motion.div key={cat.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: ci * 0.07 }}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 14, padding: '22px 22px',
                    }}
                  >
                    <h3 style={{ fontFamily: FH, fontSize: 18, color: 'var(--text-heading)', marginBottom: 16 }}>
                      {cat.title}
                    </h3>
                    {cat.items.map(item => (
                      <motion.div key={item.id}
                        whileHover={{ x: 3 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => toggle(cat.id, item.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 0',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                        }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                          border: item.checked ? 'none' : '1.5px solid var(--border-solid)',
                          background: item.checked ? '#e07020' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}>
                          {item.checked && <Check size={12} strokeWidth={3} color="#fff" />}
                        </div>

                        {/* Icon */}
                        <item.Icon size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

                        {/* Label */}
                        <span style={{
                          fontFamily: FF, fontSize: 14, fontWeight: 500, flex: 1,
                          color: item.checked ? 'var(--text-muted)' : 'var(--text-body)',
                          textDecoration: item.checked ? 'line-through' : 'none',
                          transition: 'all 0.2s',
                        }}>
                          {item.label}
                        </span>

                        {/* Quantity badge */}
                        <span style={{
                          fontFamily: FF, fontSize: 11, fontWeight: 700,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-alt)',
                          borderRadius: 6, padding: '2px 8px',
                          flexShrink: 0,
                        }}>
                          ×{item.qty}
                        </span>
                      </motion.div>
                    ))}
                  </motion.div>
                ))}
              </div>

              {/* Travel tips */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 14, padding: '22px 24px',
                }}
              >
                <h3 style={{ fontFamily: FH, fontSize: 18, color: 'var(--text-heading)', marginBottom: 14 }}>
                  Smart Travel Tips
                </h3>
                {tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent-hover)', flexShrink: 0, marginTop: 7,
                    }} />
                    <p style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.55 }}>{tip}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div id="ss-save-toast">Settings saved</div>
    </motion.div>
  )
}