import { motion } from 'framer-motion'
import {
  Users, Shirt, Heart, Layers, Camera, Tag, Cpu, Users2,
  Sparkles, Bookmark, Palette, PieChart, TrendingUp, UploadCloud, Settings,
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