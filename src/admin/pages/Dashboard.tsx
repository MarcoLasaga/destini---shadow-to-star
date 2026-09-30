import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, Shirt, Heart, Layers, Camera, Tag, Cpu, Users2,
  Sparkles, Bookmark, Palette, PieChart, TrendingUp, UploadCloud, Settings, Check, X, RefreshCw, ChevronDown,
} from 'lucide-react'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  INPUT_STATS, PROCESS_STATS, OUTPUT_STATS,
  REGISTERED_USERS, CLOTHING_DISTRIBUTION, USER_GROWTH,
} from '../mockData'
import type { AdminUser } from '../mockData'
import { adminApi, type DatasetOverview, type DatasetStatus } from '../../api/admin.api'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  users: Users, shirt: Shirt, heart: Heart, layers: Layers,
  camera: Camera, tag: Tag, cpu: Cpu, users2: Users2,
  sparkles: Sparkles, bookmark: Bookmark, palette: Palette, pie: PieChart,
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
      <Icon size={17} style={{ color: 'var(--accent)' }} />
      <span style={{ fontFamily: FF, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--accent)' }}>
        {label}
      </span>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, iconKey, delay }: { label: string; value: string | number; iconKey: string; delay: number }) {
  const Icon = ICON_MAP[iconKey] ?? Sparkles
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-md)' }}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 13, padding: '20px 22px',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: FF, fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        <Icon size={18} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ fontFamily: FH, fontSize: 34, color: 'var(--text-heading)', lineHeight: 1 }}>{value}</div>
    </motion.div>
  )
}

// ── User row ──────────────────────────────────────────────────────────────────
function UserRow({ user, i }: { user: AdminUser; i: number }) {
  const letter = user.name?.[0]?.toUpperCase() ?? '?'
  const isAdmin = user.role === 'ADMIN'
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.32, delay: i * 0.06 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 0', borderBottom: '1px solid var(--border)',
        cursor: 'default', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)'; (e.currentTarget as HTMLElement).style.paddingLeft = '8px'; (e.currentTarget as HTMLElement).style.paddingRight = '8px'; (e.currentTarget as HTMLElement).style.marginLeft = '-8px'; (e.currentTarget as HTMLElement).style.marginRight = '-8px'; (e.currentTarget as HTMLElement).style.borderRadius = '9px' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.paddingLeft = '0'; (e.currentTarget as HTMLElement).style.paddingRight = '0'; (e.currentTarget as HTMLElement).style.marginLeft = '0'; (e.currentTarget as HTMLElement).style.marginRight = '0'; (e.currentTarget as HTMLElement).style.borderRadius = '0' }}
    >
      {/* Avatar */}
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: FH, fontSize: 15, color: 'var(--text-heading)' }}>{letter}</span>
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </div>
        <div style={{ fontFamily: FF, fontSize: 12.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </div>
      </div>
      {/* Role badge */}
      <span style={{
        fontFamily: FF, fontSize: 11, fontWeight: 700,
        padding: '4px 11px', borderRadius: 99,
        background: isAdmin ? 'rgba(255,213,134,0.35)' : 'rgba(160,120,70,0.10)',
        color: isAdmin ? '#b07010' : 'var(--text-muted)',
        flexShrink: 0,
      }}>
        {user.role}
      </span>
    </motion.div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
function DatasetReview() {
  const [overview, setOverview] = useState<DatasetOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  function apiErrorMessage(error: unknown, fallback: string) {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as { response?: { data?: { message?: string } } }).response
      if (response?.data?.message) return response.data.message
    }
    return fallback
  }

  async function load() {
    setLoading(true); setError('')
    try { setOverview((await adminApi.getDataset()).data.data) }
    catch (error) { setError(apiErrorMessage(error, 'Could not load the dataset review queue.')) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    adminApi.getDataset()
      .then(response => { if (active) setOverview(response.data.data) })
      .catch(error => { if (active) setError(apiErrorMessage(error, 'Could not load the dataset review queue.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function review(id: string, status: DatasetStatus) {
    setBusyId(id)
    try { await adminApi.reviewDatasetItem(id, status); await load() }
    catch (error) { setError(apiErrorMessage(error, 'The review decision could not be saved.')) }
    finally { setBusyId(null) }
  }

  const pending = overview?.pending.filter(item => activeCategory === 'ALL' || item.category === activeCategory) ?? []
  const categories = ['ALL', ...(overview?.categories.map(category => category.category) ?? [])]

  function rubric(item: DatasetOverview['pending'][number]) {
    const hasImage = Boolean(item.image_url)
    const hasName = Boolean(item.clothing_name?.trim())
    const metadataCount = [item.color, item.material, item.brand, item.style, item.occasion, item.season].filter(Boolean).length
    const hardReject = !hasImage
    const suggestApprove = hasImage && hasName && metadataCount >= 2
    return {
      label: hardReject ? 'SUGGEST REJECT' : suggestApprove ? 'SUGGEST APPROVE' : 'NEEDS REVIEW',
      color: hardReject ? '#c02020' : suggestApprove ? '#238636' : '#9c6b10',
      checks: [
        { label: 'Image is present', pass: hasImage },
        { label: 'Name is descriptive', pass: hasName },
        { label: 'At least two metadata fields supplied', pass: metadataCount >= 2 },
        { label: 'One garment is clearly visible and in focus', pass: null },
        { label: 'Submitted category matches the image', pass: null },
        { label: 'Not a duplicate or near-duplicate', pass: null },
      ],
    }
  }

  return (
    <section style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <SectionHeader icon={Layers} label="CNN Dataset Readiness" />
        <button onClick={() => void load()} title="Refresh dataset counts" disabled={loading}
          style={{ border: '1px solid var(--border-solid)', borderRadius: 9, padding: '7px 10px', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}><RefreshCw size={15} /></button>
      </div>
      {error && <p style={{ fontFamily: FF, color: '#b42318', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {overview && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }} className="admin-dataset-grid">
          {overview.categories.map(category => <div key={category.category} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 13, padding: 16 }}>
            <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 12, color: 'var(--text-heading)', marginBottom: 8 }}>{category.category}</div>
            <div style={{ fontFamily: FH, fontSize: 25, color: category.ready ? '#238636' : 'var(--text-heading)' }}>{category.approved} <span style={{ fontFamily: FF, fontSize: 12, color: 'var(--text-muted)' }}>/ {category.target}</span></div>
            <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 99, overflow: 'hidden', margin: '10px 0' }}><div style={{ width: `${Math.min(100, category.approved / category.target * 100)}%`, height: '100%', background: category.ready ? '#238636' : 'var(--accent)' }} /></div>
            <div style={{ fontFamily: FF, fontSize: 11.5, color: 'var(--text-muted)' }}>{category.pending} pending · {category.rejected} rejected</div>
          </div>)}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 13, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div><div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)' }}>Review queue</div><div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>{overview.totals.pending} pending · {overview.ready ? 'Ready to train' : 'Not ready to train'}</div></div>
            <span style={{ fontFamily: FF, fontWeight: 800, fontSize: 12, color: overview.ready ? '#238636' : '#9c6b10' }}>{overview.ready ? 'DATASET READY' : 'COLLECT MORE DATA'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {categories.map(category => <button key={category} onClick={() => setActiveCategory(category)} style={{ border: '1px solid var(--border-solid)', borderRadius: 99, padding: '6px 12px', background: activeCategory === category ? '#2b1f0e' : 'var(--bg-card)', color: activeCategory === category ? '#fff' : 'var(--text-body)', fontFamily: FF, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{category}{category === 'ALL' ? ` (${overview.pending.length})` : ` (${overview.categories.find(item => item.category === category)?.pending ?? 0})`}</button>)}
          </div>
          {pending.length === 0 ? <div style={{ fontFamily: FF, color: 'var(--text-muted)', fontSize: 14 }}>No uploads waiting in this category.</div> : pending.map(item => <div key={item.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {item.image_url ? <img src={item.image_url} alt={item.clothing_name} style={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 9 }} /> : <div style={{ width: 58, height: 58, borderRadius: 9, background: 'var(--bg-alt)' }} />}
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: FF, fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.clothing_name}</div><div style={{ fontFamily: FF, fontSize: 12, color: 'var(--text-muted)' }}>{item.category} · submitted by {item.user_id.slice(0, 8)}</div></div>
              <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} title="Show upload details" style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid var(--border-solid)', borderRadius: 8, padding: '7px 9px', background: 'var(--bg-card)', color: 'var(--text-body)', fontFamily: FF, fontSize: 12, cursor: 'pointer' }}>Details <ChevronDown size={14} style={{ transform: expandedId === item.id ? 'rotate(180deg)' : undefined }} /></button>
              <button onClick={() => void review(item.id, 'APPROVED')} disabled={busyId === item.id} title="Approve for dataset" style={{ border: 0, borderRadius: 8, padding: 8, background: 'rgba(35,134,54,.12)', color: '#238636', cursor: 'pointer' }}><Check size={17} /></button>
              <button onClick={() => void review(item.id, 'REJECTED')} disabled={busyId === item.id} title="Reject from dataset" style={{ border: 0, borderRadius: 8, padding: 8, background: 'rgba(224,58,58,.10)', color: '#c02020', cursor: 'pointer' }}><X size={17} /></button>
            </div>
            {expandedId === item.id && <div style={{ margin: '12px 0 0 70px', padding: 14, borderRadius: 10, background: 'var(--bg-alt)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '9px 18px' }} className="dataset-details">
              <div style={{ gridColumn: '1 / -1', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><div style={{ fontFamily: FF, fontWeight: 800, fontSize: 13, color: 'var(--text-heading)' }}>Review rubric</div><span style={{ fontFamily: FF, fontSize: 11, fontWeight: 800, color: rubric(item).color }}>{rubric(item).label}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 5 }} className="rubric-grid">
                  {rubric(item).checks.map(check => <div key={check.label} style={{ fontFamily: FF, fontSize: 12, color: check.pass === null ? 'var(--text-muted)' : check.pass ? '#238636' : '#c02020' }}>{check.pass === null ? '○' : check.pass ? '✓' : '×'} {check.label}{check.pass === null ? ' — verify manually' : ''}</div>)}
                </div>
                <div style={{ fontFamily: FF, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 8 }}>This is a suggestion only. Confirm the image and metadata before approving.</div>
              </div>
              {[['Category', item.category], ['Color', item.color], ['Material', item.material], ['Brand', item.brand], ['Style', item.style], ['Occasion', item.occasion], ['Season', item.season], ['Subcategory', item.subcategory], ['Notes', item.notes]].map(([label, value]) => <div key={label}><div style={{ fontFamily: FF, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)', fontWeight: 800 }}>{label}</div><div style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-body)', marginTop: 2 }}>{value || 'Not provided'}</div></div>)}
            </div>}
          </div>)}
        </div>
      </>}
      {!overview && loading && <div style={{ fontFamily: FF, color: 'var(--text-muted)', fontSize: 14 }}>Loading review data…</div>}
      <style>{`@media (max-width: 1100px) { .admin-dataset-grid { grid-template-columns: repeat(2,1fr) !important; } .dataset-details { grid-template-columns: repeat(2, minmax(0,1fr)) !important; } } @media (max-width: 560px) { .admin-dataset-grid { grid-template-columns: 1fr !important; } .dataset-details, .rubric-grid { grid-template-columns: 1fr !important; margin-left: 0 !important; } }`}</style>
    </section>
  )
}

export default function AdminDashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ padding: '32px 32px 80px', background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 34 }}>
        <h1 style={{ fontFamily: FH, fontSize: 34, color: 'var(--text-heading)', marginBottom: 6 }}>
          System Dashboard
        </h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
          IPO Model — Input, Process, and Output monitoring for system evaluation
        </p>
      </div>

      <DatasetReview />

      {/* ── INPUT MONITORING ─────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader icon={UploadCloud} label="Input Monitoring" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="admin-stat-grid">
          {INPUT_STATS.map((s, i) => (
            <StatCard key={s.key} label={s.label} value={s.value} iconKey={s.icon} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── PROCESS MONITORING ───────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <SectionHeader icon={Settings} label="Process Monitoring" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="admin-stat-grid">
          {PROCESS_STATS.map((s, i) => (
            <StatCard key={s.key} label={s.label} value={s.value} iconKey={s.icon} delay={i * 0.07 + 0.3} />
          ))}
        </div>
      </section>

      {/* ── OUTPUT MONITORING ────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeader icon={TrendingUp} label="Output Monitoring" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }} className="admin-stat-grid">
          {OUTPUT_STATS.map((s, i) => (
            <StatCard key={s.key} label={s.label} value={s.value} iconKey={s.icon} delay={i * 0.07 + 0.6} />
          ))}
        </div>
      </section>

      {/* ── REGISTERED USERS + CLOTHING DISTRIBUTION ─────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 32 }} className="admin-bottom-grid">

        {/* Users table */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.8 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 15, padding: '24px 24px 16px' }}
        >
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 18 }}>
            Registered Users
          </div>
          <div>
            {REGISTERED_USERS.map((u, i) => (
              <UserRow key={u.id} user={u} i={i} />
            ))}
          </div>
        </motion.div>

        {/* Clothing distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.88 }}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 15, padding: '24px' }}
        >
          <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 20 }}>
            Clothing Distribution
          </div>

          {CLOTHING_DISTRIBUTION.length === 0 ? (
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>No clothing data yet</p>
          ) : (
            <>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={CLOTHING_DISTRIBUTION} cx="50%" cy="50%" outerRadius={80} dataKey="value" strokeWidth={0}>
                      {CLOTHING_DISTRIBUTION.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontFamily: FF, fontSize: 12.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-body)' }}
                      formatter={(value) => `${value}%`}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                {CLOTHING_DISTRIBUTION.map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                      <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 600, color: 'var(--text-body)' }}>{item.name}</span>
                    </div>
                    <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: 'var(--text-muted)' }}>{item.value}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── User growth chart ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.96 }}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 15, padding: '24px' }}
      >
        <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: 'var(--text-heading)', marginBottom: 20 }}>
          User Growth
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={USER_GROWTH}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontFamily: FF, fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontFamily: FF, fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontFamily: FF, fontSize: 12.5, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-body)' }} />
              <Line type="monotone" dataKey="users" stroke="var(--accent)" strokeWidth={3} dot={{ fill: 'var(--accent)', r: 5, strokeWidth: 0 }} activeDot={{ r: 7 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <style>{`
        @media (max-width: 1100px) { .admin-stat-grid  { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 767px)  { .admin-stat-grid  { grid-template-columns: 1fr !important; } .admin-bottom-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </motion.div>
  )
}
