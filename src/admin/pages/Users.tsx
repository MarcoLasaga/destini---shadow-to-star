import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Trash2, X, AlertTriangle } from 'lucide-react'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

// ── Types ──────────────────────────────────────────────────────────────────────
type UserRole = 'ADMIN' | 'USER'

interface AdminUser {
  id:       string
  name:     string
  email:    string
  role:     UserRole
  gender:   string
  bodyType: string
  styles:   string
  joined:   string
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const INITIAL_USERS: AdminUser[] = [
  { id: '1', name: 'Admin',            email: 'admin@stylesense.com', role: 'ADMIN', gender: 'Prefer-Not-To-Say', bodyType: 'Average', styles: 'Casual', joined: '11/15/2023' },
  { id: '2', name: 'Melgeri',          email: 'marco@gmail.com',      role: 'USER',  gender: 'Prefer-Not-To-Say', bodyType: 'Average', styles: 'Casual', joined: '3/23/2026'  },
  { id: '3', name: 'Mico Crisologo',   email: 'mico@gmail.com',       role: 'USER',  gender: 'Prefer-Not-To-Say', bodyType: 'Average', styles: 'Casual', joined: '3/23/2026'  },
  { id: '4', name: 'Jonathan Jungle Main', email: 'vi@gmail.com',     role: 'USER',  gender: 'Prefer-Not-To-Say', bodyType: 'Average', styles: 'Casual', joined: '3/23/2026'  },
  { id: '5', name: 'James Carter',     email: 'james.carter@email.com', role: 'USER', gender: 'Male',   bodyType: 'Athletic', styles: 'Sporty',  joined: '4/10/2026' },
  { id: '6', name: 'Sophia Reyes',     email: 'sophia.reyes@email.com', role: 'USER', gender: 'Female', bodyType: 'Slim',     styles: 'Minimalist', joined: '4/15/2026' },
  { id: '7', name: 'Ethan Cruz',       email: 'ethan.cruz@email.com',   role: 'USER', gender: 'Male',   bodyType: 'Average',  styles: 'Streetwear', joined: '5/01/2026' },
]

// ── Delete confirmation modal ──────────────────────────────────────────────────
function DeleteModal({
  open, userName, onCancel, onConfirm,
}: { open: boolean; userName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{   opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.24, ease: [0.34, 1.1, 0.64, 1] }}
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 18, padding: '30px 28px 24px', width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)', textAlign: 'center', position: 'relative' }}
          >
            <button onClick={onCancel}
              style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
            ><X size={18} /></button>

            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'rgba(224,58,58,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <AlertTriangle size={26} style={{ color: '#e03a3a' }} />
            </div>

            <h2 style={{ fontFamily: FH, fontSize: 21, color: 'var(--text-heading)', marginBottom: 8 }}>
              Remove User?
            </h2>
            <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.55 }}>
              Are you sure you want to remove <strong style={{ color: 'var(--text-body)' }}>{userName}</strong>?<br />
              This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={onCancel}
                style={{ flex: 1, fontFamily: FF, fontSize: 14, fontWeight: 600, color: 'var(--text-body)', background: 'none', border: '1.5px solid var(--border-solid)', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-solid)' }}
              >Cancel</button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={onConfirm}
                style={{ flex: 1, fontFamily: FF, fontSize: 14, fontWeight: 700, color: '#fff', background: '#e03a3a', border: 'none', borderRadius: 10, padding: '10px 0', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#c02020' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#e03a3a' }}
              >Remove</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Table header cell ──────────────────────────────────────────────────────────
function TH({ children, w }: { children: React.ReactNode; w?: number | string }) {
  return (
    <th style={{
      fontFamily: FF, fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)',
      padding: '13px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)',
      whiteSpace: 'nowrap', width: w,
    }}>
      {children}
    </th>
  )
}

// ── Table data cell ────────────────────────────────────────────────────────────
function TD({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{
      fontFamily: FF, fontSize: 14, fontWeight: muted ? 500 : 600,
      color: muted ? 'var(--text-muted)' : 'var(--text-body)',
      padding: '14px 16px', borderBottom: '1px solid var(--border)',
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminUsers() {
  const [users,        setUsers]        = useState<AdminUser[]>(INITIAL_USERS)
  const [search,       setSearch]       = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)

  const filtered = useMemo(() =>
    users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    ), [users, search])

  function confirmDelete() {
    if (!deleteTarget) return
    setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ padding: '32px 32px 80px', background: 'var(--bg-page)', minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FH, fontSize: 34, color: 'var(--text-heading)', marginBottom: 6 }}>
          User Management
        </h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
          View and manage all registered users
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 26 }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          style={{
            width: '100%', height: 44,
            border: '1.5px solid var(--border-solid)', borderRadius: 11,
            padding: '0 16px 0 40px',
            fontFamily: FF, fontSize: 14.5, color: 'var(--text-body)',
            background: 'var(--bg-card)', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--secondary)'; e.target.style.boxShadow = '0 0 0 3px var(--secondary-soft)' }}
          onBlur={e  => { e.target.style.borderColor = 'var(--border-solid)'; e.target.style.boxShadow = 'none' }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-alt)' }}>
                <TH w={220}>User</TH>
                <TH w={220}>Email</TH>
                <TH w={90}>Role</TH>
                <TH w={160}>Gender</TH>
                <TH w={120}>Body Type</TH>
                <TH w={100}>Styles</TH>
                <TH w={110}>Joined</TH>
                <TH w={70}>Actions</TH>
              </tr>
            </thead>

            <AnimatePresence mode="popLayout">
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center', fontFamily: FF, fontSize: 14, color: 'var(--text-muted)' }}>
                      No users found matching &ldquo;{search}&rdquo;
                    </td>
                  </tr>
                ) : (
                  filtered.map((user, i) => {
                    const letter  = user.name?.[0]?.toUpperCase() ?? '?'
                    const isAdmin = user.role === 'ADMIN'
                    return (
                      <motion.tr key={user.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        style={{ transition: 'background 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--secondary-soft)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        {/* User */}
                        <TD>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-alt)', border: '1px solid var(--border-solid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontFamily: FH, fontSize: 14, color: 'var(--text-heading)' }}>{letter}</span>
                            </div>
                            <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: 'var(--text-heading)', whiteSpace: 'nowrap' }}>
                              {user.name}
                            </span>
                          </div>
                        </TD>

                        {/* Email */}
                        <TD muted>{user.email}</TD>

                        {/* Role */}
                        <TD>
                          <span style={{
                            fontFamily: FF, fontSize: 11.5, fontWeight: 700,
                            padding: '4px 12px', borderRadius: 99,
                            background: isAdmin ? 'rgba(255,213,134,0.35)' : 'rgba(160,120,70,0.10)',
                            color: isAdmin ? '#b07010' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                          }}>
                            {user.role}
                          </span>
                        </TD>

                        {/* Gender */}
                        <TD muted>{user.gender}</TD>

                        {/* Body Type */}
                        <TD muted>{user.bodyType}</TD>

                        {/* Styles */}
                        <TD>
                          <span style={{
                            fontFamily: FF, fontSize: 12, fontWeight: 600,
                            padding: '3px 11px', borderRadius: 99,
                            background: 'var(--bg-alt)', color: 'var(--text-body)',
                            whiteSpace: 'nowrap',
                          }}>
                            {user.styles}
                          </span>
                        </TD>

                        {/* Joined */}
                        <TD muted>{user.joined}</TD>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                          <motion.button
                            whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                            onClick={() => setDeleteTarget(user)}
                            title={`Remove ${user.name}`}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '5px 6px',
                              borderRadius: 7, display: 'flex', alignItems: 'center',
                              transition: 'color 0.18s, background 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#e03a3a'; e.currentTarget.style.background = 'rgba(224,58,58,0.08)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
                          >
                            <Trash2 size={17} />
                          </motion.button>
                        </td>
                      </motion.tr>
                    )
                  })
                )}
              </tbody>
            </AnimatePresence>
          </table>
        </div>

        {/* Footer row */}
        {filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontFamily: FF, fontSize: 13, color: 'var(--text-muted)' }}>
              {filtered.length} of {users.length} user{users.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{
                fontFamily: FF, fontSize: 12, fontWeight: 700,
                padding: '3px 11px', borderRadius: 99,
                background: 'rgba(255,213,134,0.35)', color: '#b07010',
              }}>
                {users.filter(u => u.role === 'ADMIN').length} Admins
              </span>
              <span style={{
                fontFamily: FF, fontSize: 12, fontWeight: 700,
                padding: '3px 11px', borderRadius: 99,
                background: 'rgba(160,120,70,0.10)', color: 'var(--text-muted)',
              }}>
                {users.filter(u => u.role === 'USER').length} Users
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <DeleteModal
        open={!!deleteTarget}
        userName={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </motion.div>
  )
}