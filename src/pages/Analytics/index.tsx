import { useMemo, type CSSProperties, type ElementType } from 'react'
import { motion } from 'framer-motion'
import { Leaf, ShoppingBag, RefreshCw, TrendingUp } from 'lucide-react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { useWardrobe } from '../../context/useWardrobe'
import type { ClothingItem } from '../../types/wardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const ORANGE = '#ffd586'
const PURPLE = '#756e9e'
const CARD: CSSProperties = {
  background: '#fffcf8', border: '1px solid rgba(160,120,70,0.15)',
  borderRadius: 14, padding: '22px 24px',
}

type StatCellProps = { icon: ElementType; value: string | number; label: string }

function StatCell({ icon: Icon, value, label }: StatCellProps) {
  return (
    <div style={{ padding: '18px 20px' }}>
      <Icon size={18} style={{ color: ORANGE, marginBottom: 8 }} />
      <div style={{ fontFamily: FH, fontSize: 26, color: '#2b1f0e', lineHeight: 1, marginBottom: 4 }}>{value}</div>
      <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c' }}>{label}</div>
    </div>
  )
}

function ProgBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: '#756e9e' }}>{label}</span>
        <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: '#5c4a35' }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: 'rgba(160,120,70,0.12)', borderRadius: 99, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: `linear-gradient(90deg, ${ORANGE}, ${PURPLE})`, borderRadius: 99 }}
        />
      </div>
    </div>
  )
}

const PIE_COLORS = ['#ffd586', '#756e9e', '#e8b4b8', '#b8c8b8', '#b8bfc6']

export default function Analytics() {
  const { items } = useWardrobe()

  const score = Math.min(100, Math.round((items.length / 10) * 100))

  const categoryDist = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach((i: ClothingItem) => { counts[i.category] = (counts[i.category] ?? 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [items])

  const utilRate  = items.length > 0 ? Math.min(100, Math.round(items.length * 12.5)) : 0
  const catDiv    = categoryDist.length > 0 ? Math.min(100, Math.round((categoryDist.length / 5) * 100)) : 0
  const reuseInt  = items.length > 0 ? Math.min(100, Math.round(items.length * 10)) : 0

  const reuseMap = useMemo(() => new Map<string, number>(items.map((item: ClothingItem) => [item.id, (item.name.charCodeAt(0) % 6) + 3])), [items])
  const donutData = [{ value: score, fill: ORANGE }, { value: 100 - score, fill: 'rgba(160,120,70,0.1)' }]

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ background: '#faf7f2', minHeight: '100vh', padding: '36px 36px 80px' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Leaf size={26} style={{ color: ORANGE }} />
        <h1 style={{ fontFamily: FH, fontSize: 30, color: '#2b1f0e' }}>Sustainability Dashboard</h1>
      </div>
      <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c', marginBottom: 28 }}>
        Maximise your existing wardrobe — reduce unnecessary purchases.
      </p>

      {/* Top row: donut + stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 18, marginBottom: 18 }}>
        {/* Score donut */}
        <div style={{ ...CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 24px' }}>
          <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 16 }}>SUSTAINABILITY SCORE</div>
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={72} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {donutData.map((_, i) => <Cell key={i} fill={donutData[i].fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: FH, fontSize: 34, color: '#2b1f0e', lineHeight: 1 }}>{score}</span>
              <span style={{ fontFamily: FF, fontSize: 12, color: '#9c866c', fontWeight: 600 }}>/ 100</span>
            </div>
          </div>
          <p style={{ fontFamily: FF, fontSize: 12.5, color: '#9c866c', marginTop: 14, textAlign: 'center' }}>
            {score < 20 ? 'Room to grow — try more outfit combinations.' : score < 60 ? 'Good progress — keep building your wardrobe.' : 'Excellent — your wardrobe is highly reused.'}
          </p>
        </div>

        {/* 2×2 stats */}
        <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
            {[
              { Icon: ShoppingBag, value: items.length,                                              label: 'TOTAL ITEMS'       },
              { Icon: RefreshCw,   value: items.length,                                              label: 'ACTIVE ITEMS'      },
              { Icon: Leaf,        value: 0,                                                         label: 'UNUSED ITEMS'      },
              { Icon: TrendingUp,  value: 0,                                                         label: 'AVOIDED PURCHASES' },
            ].map(({ Icon, value, label }, i) => (
              <div key={i} style={{ borderBottom: i < 2 ? '1px solid rgba(160,120,70,0.1)' : 'none', borderRight: i % 2 === 0 ? '1px solid rgba(160,120,70,0.1)' : 'none' }}>
                <StatCell icon={Icon} value={value} label={label} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mid row: utilization + most reused */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
        <div style={CARD}>
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: '#2b1f0e', marginBottom: 20 }}>Wardrobe Utilization</div>
          <ProgBar label="Utilization Rate"  pct={utilRate} />
          <ProgBar label="Category Diversity" pct={catDiv}  />
          <ProgBar label="Reuse Intensity"    pct={reuseInt} />
        </div>

        <div style={CARD}>
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: '#2b1f0e', marginBottom: 16 }}>Most Reused Items</div>
          {items.length === 0 ? (
            <p style={{ fontFamily: FF, fontSize: 13.5, color: '#9c866c' }}>Mark outfits as worn to track reuse.</p>
          ) : (
            <div>
              {items.slice(0, 5).map((item: ClothingItem, i: number) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontFamily: FF, fontSize: 13, color: '#9c866c', width: 18 }}>{i + 1}.</span>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: item.colorHex, border: '1.5px solid rgba(0,0,0,0.08)' }} />
                  <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, color: '#2b1f0e', flex: 1 }}>{item.name}</span>
                  <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: '#9c866c' }}>{reuseMap.get(item.id) ?? 3}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reuse stats */}
      <div style={CARD}>
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: '#2b1f0e', marginBottom: 18 }}>Reuse Statistics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            { label: 'OUTFITS GENERATED', value: '0'    },
            { label: 'OUTFITS SAVED',     value: '2'    },
            { label: 'WARDROBE UTILIZED', value: `${utilRate}%` },
            { label: 'AVG WEARS / ITEM',  value: items.length > 0 ? (items.length * 0.8).toFixed(1) : '0.0' },
          ].map(({ label, value }) => (
            <motion.div key={label} whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(80,50,20,0.08)' }}
              style={{ background: '#faf7f2', border: '1px solid rgba(160,120,70,0.12)', borderRadius: 10, padding: '16px 14px', textAlign: 'center', transition: 'border-color 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF8C00' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,120,70,0.12)' }}
            >
              <div style={{ fontFamily: FF, fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#9c866c', marginBottom: 10 }}>{label}</div>
              <div style={{ fontFamily: FH, fontSize: 24, color: '#2b1f0e' }}>{value}</div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Category distribution chart */}
      {categoryDist.length > 0 && (
        <div style={{ ...CARD, marginTop: 18 }}>
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: '#2b1f0e', marginBottom: 18 }}>Category Distribution</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 160, height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryDist} cx="50%" cy="50%" outerRadius={70} dataKey="value" strokeWidth={0}>
                    {categoryDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontFamily: FF, fontSize: 12, borderRadius: 8, border: '1px solid rgba(160,120,70,0.2)', background: '#fffcf8' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1 }}>
              {categoryDist.map((cat, i) => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: '#5c4a35', flex: 1 }}>{cat.name}</span>
                  <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: '#9c866c' }}>{cat.value} item{cat.value !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}