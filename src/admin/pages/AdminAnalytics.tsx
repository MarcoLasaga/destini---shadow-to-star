import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { useWardrobe } from '../../context/WardrobeContext'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// Light-mode palette only — no CSS vars that might pick up dark mode
const C = {
  bg:      '#faf7f2',
  card:    '#fffcf8',
  border:  'rgba(160,120,70,0.15)',
  heading: '#2b1f0e',
  body:    '#5c4a35',
  muted:   '#9c866c',
  accent:  '#756e9e',
  gold:    '#ffd586',
  alt:     '#f3eee5',
}

const PIE_COLORS = ['#ffd586', '#756e9e', '#e8b4b8', '#b8c8b8', '#b8bfc6', '#c3b091', '#f0c080', '#a0b8d0']

// ── Shared sub-components ──────────────────────────────────────────────────────
function StatCard({ label, value, delay }: { label: string; value: string | number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      whileHover={{ y: -3, boxShadow: '0 6px 24px rgba(80,50,20,0.10)' }}
      style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 13, padding: '18px 22px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
    >
      <div style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: FH, fontSize: 32, color: C.heading, lineHeight: 1 }}>
        {value}
      </div>
    </motion.div>
  )
}

function ChartCard({ title, children, delay }: { title: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: 15, padding: '22px 24px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      whileHover={{ boxShadow: '0 4px 16px rgba(80,50,20,0.08)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
    >
      <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 17, color: C.heading, marginBottom: 18 }}>
        {title}
      </div>
      {children}
    </motion.div>
  )
}

function NoData({ msg = 'No data' }: { msg?: string }) {
  return (
    <p style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, margin: 0 }}>{msg}</p>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: {
    fontFamily: FF, fontSize: 12.5, borderRadius: 9,
    border: `1px solid ${C.border}`, background: C.card, color: C.body,
  },
}

// ── Mini pie chart with legend ─────────────────────────────────────────────────
function MiniPie({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <NoData />
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ width: 140, height: 140, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={62} dataKey="value" strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip {...TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
              <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: C.body }}>{d.name}</span>
            </div>
            <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 700, color: C.muted }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mini bar chart ─────────────────────────────────────────────────────────────
function MiniBar({ data }: { data: { name: string; value: number }[] }) {
  if (!data.length) return <NoData />
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
          <XAxis dataKey="name" tick={{ fontFamily: FF, fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontFamily: FF, fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Bar dataKey="value" fill={C.gold} radius={[5, 5, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const { items } = useWardrobe()

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeUsers   = 2           // mock (would come from user list)
  const avgItemsUser  = items.length > 0 ? (items.length / activeUsers).toFixed(1) : '0.0'
  const avgSavedUser  = (1 / activeUsers).toFixed(1)  // 1 saved outfit mock
  const totalWorn     = items.reduce((sum, i) => sum + (i.timesWorn ?? 0), 0)

  const categoryDist = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.category] = (c[i.category] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [items])

  const colorDist = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.color] = (c[i.color] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))
  }, [items])

  const styleDist = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.style] = (c[i.style] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [items])

  const occasionDist = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.occasion] = (c[i.occasion] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [items])

  const fabricDist = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.fabric] = (c[i.fabric] ?? 0) + 1 })
    return Object.entries(c).map(([name, value]) => ({ name, value }))
  }, [items])

  const mostWorn = useMemo(() =>
    [...items]
      .filter(i => (i.timesWorn ?? 0) > 0)
      .sort((a, b) => (b.timesWorn ?? 0) - (a.timesWorn ?? 0))
      .slice(0, 6),
    [items]
  )

  const totalClothes  = items.length
  const totalSaved    = 1            // mock
  const totalGenerated = 0           // mock
  const saveRate      = totalGenerated > 0 ? Math.round((totalSaved / totalGenerated) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ padding: '32px 32px 80px', background: C.bg, minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FH, fontSize: 34, color: C.heading, marginBottom: 6 }}>
          Analytics &amp; Insights
        </h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: C.muted }}>
          Wardrobe data analysis for system evaluation
        </p>
      </div>

      {/* ── Top stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}
        className="admin-stat-grid"
      >
        <StatCard label="ACTIVE USERS"      value={activeUsers}    delay={0     } />
        <StatCard label="AVG ITEMS/USER"    value={avgItemsUser}   delay={0.07  } />
        <StatCard label="AVG SAVED/USER"    value={avgSavedUser}   delay={0.14  } />
        <StatCard label="TOTAL WORN COUNT"  value={totalWorn}      delay={0.21  } />
      </div>

      {/* ── Distribution charts row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}
        className="admin-chart-grid"
      >
        <ChartCard title="Items by Category" delay={0.28}>
          {categoryDist.length > 0 ? <MiniPie data={categoryDist} /> : <NoData />}
        </ChartCard>

        <ChartCard title="Color Distribution" delay={0.32}>
          {colorDist.length > 0 ? <MiniBar data={colorDist} /> : <NoData />}
        </ChartCard>
      </div>

      {/* ── Distribution charts row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}
        className="admin-chart-grid"
      >
        <ChartCard title="Style Distribution" delay={0.36}>
          {styleDist.length > 0 ? <MiniPie data={styleDist} /> : <NoData />}
        </ChartCard>

        <ChartCard title="Occasion Distribution" delay={0.40}>
          {occasionDist.length > 0 ? <MiniPie data={occasionDist} /> : <NoData />}
        </ChartCard>
      </div>

      {/* ── Distribution charts row 3 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}
        className="admin-chart-grid"
      >
        <ChartCard title="Fabric Distribution" delay={0.44}>
          {fabricDist.length > 0 ? <MiniBar data={fabricDist} /> : <NoData />}
        </ChartCard>

        <ChartCard title="Most Worn Items" delay={0.48}>
          {mostWorn.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mostWorn.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: FF, fontSize: 13, color: C.muted, width: 20, flexShrink: 0 }}>{i + 1}.</span>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: item.colorHex, border: '1.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
                  <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 600, color: C.body, flex: 1 }}>{item.name}</span>
                  <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: C.accent }}>{item.timesWorn}×</span>
                </div>
              ))}
            </div>
          ) : <NoData msg="No wear data yet" />}
        </ChartCard>
      </div>

      {/* ── User Engagement Summary ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.54 }}
        style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 15, padding: '24px 26px' }}
      >
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: C.heading, marginBottom: 20 }}>
          User Engagement Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}
          className="admin-stat-grid"
        >
          {[
            { label: 'TOTAL OUTFITS GENERATED', value: totalGenerated },
            { label: 'TOTAL OUTFITS SAVED',     value: totalSaved     },
            { label: 'TOTAL CLOTHES UPLOADED',  value: totalClothes   },
            { label: 'SAVE RATE',                value: `${saveRate}%` },
          ].map(({ label, value }) => (
            <div key={label}
              style={{
                background: C.alt, border: `1px solid ${C.border}`,
                borderRadius: 11, padding: '16px 15px', textAlign: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.gold }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border }}
            >
              <div style={{ fontFamily: FF, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: C.muted, marginBottom: 10 }}>{label}</div>
              <div style={{ fontFamily: FH, fontSize: 26, color: C.heading }}>{value}</div>
            </div>
          ))}
        </div>
      </motion.div>

      <style>{`
        @media (max-width: 1100px) { .admin-stat-grid  { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 767px)  { .admin-stat-grid  { grid-template-columns: 1fr !important; } .admin-chart-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </motion.div>
  )
}