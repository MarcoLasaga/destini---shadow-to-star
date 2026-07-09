import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, TrendingUp, Calendar, DollarSign, Sparkles, Trash2, CheckCircle, X, AlertTriangle, RefreshCw } from 'lucide-react'
import { useWardrobeItem, useDeleteItem, useToggleFavorite, useMarkClean } from '../../hooks/useWardrobe'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const LAUNDRY_LABEL: Record<string, string> = {
  CLEAN:               'Clean',
  NEEDS_WASHING_SOON:  'Needs Washing Soon',
  NEEDS_WASHING:       'Needs Washing',
}

const LAUNDRY_COLOR: Record<string, string> = {
  CLEAN:               '#2a9d5c',
  NEEDS_WASHING_SOON:  'var(--accent)',
  NEEDS_WASHING:       '#e03a3a',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return `${d.getMonth()+1}/${d.getDate()}/${d.getFullYear()}`
}

function InsightCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <Icon size={12} style={{ color:'var(--text-muted)' }} />
        <span style={{ fontFamily:FF, fontSize:10, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text-muted)' }}>{label}</span>
      </div>
      <div style={{ fontFamily:FH, fontSize:22, color:'var(--text-heading)' }}>{value}</div>
    </div>
  )
}

function ConfirmModal({ open, itemName, onCancel, onConfirm }: { open:boolean; itemName:string; onCancel:()=>void; onConfirm:()=>void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={onCancel}
        >
          <motion.div initial={{ opacity:0, scale:0.94, y:14 }} animate={{ opacity:1, scale:1, y:0 }} exit={{ opacity:0, scale:0.94, y:14 }}
            transition={{ duration:0.24, ease:[0.34,1.1,0.64,1] }}
            onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg-card)', borderRadius:18, padding:'30px 28px 24px', width:'100%', maxWidth:400, boxShadow:'var(--shadow-lg)', textAlign:'center', position:'relative' }}
          >
            <button onClick={onCancel} style={{ position:'absolute', top:14, right:14, background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--accent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='var(--text-muted)' }}
            ><X size={18} /></button>
            <div style={{ width:58, height:58, borderRadius:'50%', background:'rgba(224,58,58,0.10)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <AlertTriangle size={26} style={{ color:'#e03a3a' }} />
            </div>
            <h2 style={{ fontFamily:FH, fontSize:21, color:'var(--text-heading)', marginBottom:8 }}>Remove this item?</h2>
            <p style={{ fontFamily:FF, fontSize:14, color:'var(--text-muted)', marginBottom:24, lineHeight:1.55 }}>
              Are you sure you want to remove <strong style={{ color:'var(--text-body)' }}>{itemName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display:'flex', gap:12 }}>
              <button onClick={onCancel}
                style={{ flex:1, fontFamily:FF, fontSize:14, fontWeight:600, color:'var(--text-body)', background:'none', border:'1.5px solid var(--border-solid)', borderRadius:10, padding:'10px 0', cursor:'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--secondary)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border-solid)' }}
              >Cancel</button>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={onConfirm}
                style={{ flex:1, fontFamily:FF, fontSize:14, fontWeight:700, color:'#fff', background:'#e03a3a', border:'none', borderRadius:10, padding:'10px 0', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='#c02020' }}
                onMouseLeave={e => { e.currentTarget.style.background='#e03a3a' }}
              >Remove</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function ClothingDetails() {
  const { clothingId } = useParams<{ clothingId: string }>()
  const navigate = useNavigate()

  const { data: item, isLoading, isError } = useWardrobeItem(clothingId ?? '')
  const deleteMut  = useDeleteItem()
  const favoriteMut= useToggleFavorite()
  const cleanMut   = useMarkClean()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast,       setToast]       = useState('')
  const [toastV,      setToastV]      = useState(false)

  function showToast(msg: string) {
    setToast(msg); setToastV(true)
    setTimeout(() => setToastV(false), 2800)
  }

  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:12 }}>
      <RefreshCw size={22} style={{ color:'var(--accent)', animation:'spin 1s linear infinite' }} />
      <span style={{ fontFamily:FF, fontSize:15, color:'var(--text-muted)' }}>Loading…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (isError || !item) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16 }}>
      <p style={{ fontFamily:FF, fontSize:15, color:'var(--text-muted)' }}>Item not found.</p>
      <button onClick={() => navigate('/wardrobe')}
        style={{ fontFamily:FF, fontSize:14, fontWeight:700, color:'#fff', background:'var(--accent)', border:'none', borderRadius:10, padding:'10px 20px', cursor:'pointer' }}
      >Back to Wardrobe</button>
    </div>
  )

  const safeItem = item!

  async function handleRemove() {
    await deleteMut.mutateAsync(safeItem.id)
    setConfirmOpen(false)
    navigate('/wardrobe')
  }

  async function handleFavorite() {
    const response = await favoriteMut.mutateAsync(safeItem.id)
    const payload = (response as { data?: { message?: string } }).data
    showToast(payload?.message ?? (safeItem.isFavorite ? 'Removed from Favorites' : 'Added to Favorites'))
  }

  async function handleMarkClean() {
    await cleanMut.mutateAsync(safeItem.id)
    showToast('Marked as Clean')
  }

  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.3 }}
      className="ss-page-wrapper" style={{ background:'var(--bg-page)', minHeight:'100vh' }}
    >
      <div style={{ maxWidth:980, margin:'0 auto' }}>

        <button onClick={() => navigate('/wardrobe')}
          style={{ display:'flex', alignItems:'center', gap:7, fontFamily:FF, fontSize:14, fontWeight:600, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer', marginBottom:26, padding:0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='var(--text-muted)' }}
        ><ArrowLeft size={16} /> Back to wardrobe</button>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:34 }} className="ss-grid-2">

          {/* Left: image */}
          <div style={{ background: 'var(--bg-alt)', borderRadius:16, position:'relative', minHeight:540, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.clothingName} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:16, position:'absolute', inset:0 }} />
              : <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--secondary)', boxShadow:'0 4px 14px rgba(0,0,0,0.15)' }} />
            }
            <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.94 }} onClick={handleFavorite}
              style={{ position:'absolute', top:16, right:16, width:40, height:40, borderRadius:'50%', background: item.isFavorite ? 'var(--accent)' : 'var(--bg-card)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow-sm)' }}
            >
              <Heart size={18} fill={item.isFavorite ? '#fff' : 'none'} stroke={item.isFavorite ? '#fff' : 'var(--text-heading)'} />
            </motion.button>
          </div>

          {/* Right: details */}
          <div>
            <div style={{ fontFamily:FF, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:'var(--accent)', marginBottom:6 }}>
              {item.category}
            </div>
            <h1 style={{ fontFamily:FH, fontSize:32, color:'var(--text-heading)', marginBottom:8 }}>{item.clothingName}</h1>

            <div style={{ fontFamily:FF, fontSize:14.5, color:'var(--text-body)', marginBottom:16 }}>
              {[item.color, item.material, item.size ? `Size ${item.size}` : null].filter(Boolean).join(' · ')}
            </div>

            {/* Tags */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:26 }}>
              {item.occasion && <span style={{ fontFamily:FF, fontSize:13, fontWeight:700, color:'var(--accent)', background:'rgba(117,110,158,0.12)', borderRadius:30, padding:'5px 14px' }}>{item.occasion}</span>}
              {item.style    && <span style={{ fontFamily:FF, fontSize:13, fontWeight:700, color:'var(--text-body)', background:'var(--bg-alt)', borderRadius:30, padding:'5px 14px' }}>{item.style}</span>}
              {item.season   && <span style={{ fontFamily:FF, fontSize:13, fontWeight:700, color:'var(--text-body)', background:'var(--bg-alt)', borderRadius:30, padding:'5px 14px' }}>{item.season.replace('_',' ')}</span>}
              {item.brand    && <span style={{ fontFamily:FF, fontSize:13, fontWeight:700, color:'var(--text-body)', background:'var(--bg-alt)', borderRadius:30, padding:'5px 14px' }}>{item.brand}</span>}
              {item.isFavorite && <span style={{ fontFamily:FF, fontSize:13, fontWeight:700, color:'var(--accent)', background:'rgba(117,110,158,0.12)', borderRadius:30, padding:'5px 14px', display:'flex', alignItems:'center', gap:5 }}><Heart size={11} fill="var(--accent)" /> Favorite</span>}
            </div>

            {/* Insights */}
            <div style={{ fontFamily:FF, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:12 }}>INSIGHTS</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
              <InsightCard icon={TrendingUp} label="Times Worn"  value={String(item.wearCount)} />
              <InsightCard icon={Calendar}   label="Last Worn"   value={fmtDate(item.lastWornAt)} />
              <InsightCard icon={Sparkles}   label="Date Added"  value={fmtDate(item.createdAt)} />
              <InsightCard icon={DollarSign} label="Est. Price"  value={item.estimatedPrice ? `$${item.estimatedPrice.toFixed(2)}` : '—'} />
            </div>

            {/* Laundry */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontFamily:FF, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 }}>LAUNDRY STATUS</div>
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{
                  fontFamily:FF, fontSize:13.5, fontWeight:700,
                  padding:'6px 16px', borderRadius:30,
                  background: LAUNDRY_COLOR[item.laundryStatus] + '18',
                  color: LAUNDRY_COLOR[item.laundryStatus],
                }}>
                  {LAUNDRY_LABEL[item.laundryStatus]}
                </span>
                {item.laundryStatus !== 'CLEAN' && (
                  <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
                    onClick={handleMarkClean} disabled={cleanMut.isPending}
                    style={{ display:'flex', alignItems:'center', gap:7, fontFamily:FF, fontSize:13.5, fontWeight:700, color:'#fff', background:'#2a9d5c', border:'none', borderRadius:10, padding:'8px 16px', cursor:'pointer' }}
                  >
                    <CheckCircle size={14} /> Mark as Clean
                  </motion.button>
                )}
              </div>
            </div>

            {/* Notes */}
            {item.notes && (
              <div style={{ marginBottom:24, background:'var(--bg-alt)', borderRadius:11, padding:'14px 16px' }}>
                <div style={{ fontFamily:FF, fontSize:11, fontWeight:700, letterSpacing:'0.10em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:7 }}>NOTES</div>
                <p style={{ fontFamily:FF, fontSize:14, color:'var(--text-body)', lineHeight:1.6, margin:0 }}>{item.notes}</p>
              </div>
            )}

            {/* Remove button */}
            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
              onClick={() => setConfirmOpen(true)}
              style={{ display:'inline-flex', alignItems:'center', gap:8, fontFamily:FF, fontSize:14, fontWeight:700, color:'#e03a3a', background:'var(--bg-card)', border:'1.5px solid rgba(224,58,58,0.4)', borderRadius:10, padding:'11px 22px', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(224,58,58,0.08)'; e.currentTarget.style.borderColor='#e03a3a' }}
              onMouseLeave={e => { e.currentTarget.style.background='var(--bg-card)'; e.currentTarget.style.borderColor='rgba(224,58,58,0.4)' }}
            >
              <Trash2 size={15} /> Remove
            </motion.button>
          </div>
        </div>
      </div>

      <ConfirmModal open={confirmOpen} itemName={item.clothingName} onCancel={() => setConfirmOpen(false)} onConfirm={handleRemove} />

      <AnimatePresence>
        {toastV && (
          <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:14 }}
            style={{ position:'fixed', bottom:28, right:28, zIndex:9999, background:'var(--bg-card)', border:'1px solid var(--border-solid)', borderRadius:13, padding:'13px 22px', boxShadow:'var(--shadow-lg)', fontFamily:FF, fontSize:14, fontWeight:700, color:'var(--text-heading)', minWidth:220 }}
          >✓ {toast}</motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}