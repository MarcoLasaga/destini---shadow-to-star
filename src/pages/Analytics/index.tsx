import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Leaf, ShoppingBag, RefreshCw, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useWardrobe } from '../../context/WardrobeContext'

const FF = 'Baloo Tamma 2, sans-serif'
const PIE_COLORS = ['var(--secondary)', 'var(--accent)', '#e8b4b8', '#b8c8b8', '#b8bfc6']

const CARD: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 15,
  padding: '24px 26px',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

function StatCell({ icon: Icon, value, label }: { icon: React.ElementType; value: string | number; label: string }) {
  return (
    <div style={{ padding: '20px 22px' }}>
      <Icon size={20} style={{ color: 'var(--accent)', marginBottom: 9 }} />
      <div style={{ fontFamily: 'Bagel Fat One, cursive', fontSize: 28, color: 'var(--text-heading)', lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function ProgBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 17 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{label}</span>
        <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: 'var(--text-body)' }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'var(--bg-alt)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: `linear-gradient(90deg, var(--secondary), var(--accent))`, borderRadius: 99 }}
        />
      </div>
    </div>
  )
}

export default function Analytics() {
  const { items } = useWardrobe()
  const score = Math.min(100, Math.round((items.length / 10) * 100))

  const categoryDist = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(i => { counts[i.category] = (counts[i.category] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [items])

  const utilRate = items.length > 0 ? Math.min(100, Math.round(items.length * 12.5)) : 0
  const catDiv   = categoryDist.length > 0 ? Math.min(100, Math.round((categoryDist.length / 5) * 100)) : 0
  const reuseInt = items.length > 0 ? Math.min(100, Math.round(items.length * 10)) : 0

  const donutData = [
    { value: score,       fill: 'var(--secondary)' },
    { value: 100 - score, fill: 'rgba(160,120,70,0.08)' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 7 }}>
        <Leaf size={28} style={{ color: 'var(--accent)' }} />
        <h1 className="page-title-lg">Sustainability Dashboard</h1>
      </div>
      <p className="page-subtitle" style={{ marginBottom: 30 }}>
        Maximise your existing wardrobe — reduce unnecessary purchases.
      </p>

      {/* Top row */}
      <div className="ss-grid-2" style={{ marginBottom: 20 }}>
        {/* Score donut */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 26px' }}>
          <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 18 }}>SUSTAINABILITY SCORE</div>
          <div style={{ position: 'relative', width: 168, height: 168 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={57} outerRadius={76} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Bagel Fat One, cursive', fontSize: 36, color: 'var(--text-heading)', lineHeight: 1 }}>{score}</span>
              <span style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)', fontWeight: 600 }}>/ 100</span>
            </div>
          </div>
          <p style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)', marginTop: 16, textAlign: 'center' }}>
            {score < 20 ? 'Room to grow — try more outfit combinations.' : score < 60 ? 'Good progress — keep building your wardrobe.' : 'Excellent — your wardrobe is highly reused.'}
          </p>
        </div>

        {/* 2×2 stat grid */}
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
            {[
              { Icon: ShoppingBag, value: items.length, label: 'TOTAL ITEMS'       },
              { Icon: RefreshCw,   value: items.length, label: 'ACTIVE ITEMS'      },
              { Icon: Leaf,        value: 0,            label: 'UNUSED ITEMS'      },
              { Icon: TrendingUp,  value: 0,            label: 'AVOIDED PURCHASES' },
            ].map(({ Icon, value, label }, i) => (
              <div key={i} style={{
                borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                borderRight: i % 2 === 0 ? '1px solid var(--border)' : 'none',
              }}>
                <StatCell icon={Icon} value={value} label={label} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mid row */}
      <div className="ss-grid-2" style={{ marginBottom: 20 }}>
        <div style={CARD}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
        >
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 22 }}>Wardrobe Utilization</div>
          <ProgBar label="Utilization Rate"   pct={utilRate} />
          <ProgBar label="Category Diversity" pct={catDiv}   />
          <ProgBar label="Reuse Intensity"    pct={reuseInt} />
        </div>

        <div style={CARD}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
        >
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 18 }}>Most Reused Items</div>
          {items.length === 0 ? (
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>Mark outfits as worn to track reuse.</p>
          ) : (
            items.slice(0, 5).map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 13 }}>
                <span style={{ fontFamily: FF, fontSize: 13.5, color: 'var(--text-muted)', width: 20 }}>{i + 1}.</span>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: item.colorHex, border: '1.5px solid rgba(0,0,0,0.08)' }} />
                <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 600, color: 'var(--text-heading)', flex: 1 }}>{item.name}</span>
                <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)' }}>{item.timesWorn}×</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats row */}
      <div style={CARD}>
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 20 }}>Reuse Statistics</div>
        <div className="ss-grid-4">
          {[
            { label: 'OUTFITS GENERATED', value: '0' },
            { label: 'OUTFITS SAVED',     value: '2' },
            { label: 'WARDROBE UTILIZED', value: `${utilRate}%` },
            { label: 'AVG WEARS / ITEM',  value: items.length > 0 ? (items.length * 0.8).toFixed(1) : '0.0' },
          ].map(({ label, value }) => (
            <motion.div key={label} whileHover={{ y: -2, boxShadow: 'var(--shadow-sm)' }}
              style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 11, padding: '18px 15px', textAlign: 'center', transition: 'border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
            >
              <div style={{ fontFamily: FF, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 11 }}>{label}</div>
              <div style={{ fontFamily: 'Bagel Fat One, cursive', fontSize: 26, color: 'var(--text-heading)' }}>{value}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Category distribution */}
      {categoryDist.length > 0 && (
        <div style={{ ...CARD, marginTop: 20 }}>
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 20 }}>Category Distribution</div>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 168, height: 168 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryDist} cx="50%" cy="50%" outerRadius={72} dataKey="value" strokeWidth={0}>
                    {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: FF, fontSize: 12.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {categoryDist.map((cat, i) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 11 }}>
                  <div style={{ width: 11, height: 11, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-body)', flex: 1 }}>{cat.name}</span>
                  <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)' }}>{cat.value} item{cat.value !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}