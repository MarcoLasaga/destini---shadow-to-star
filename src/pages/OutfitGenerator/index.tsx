import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Heart, Shirt, Sparkles } from 'lucide-react'
import { api } from '../../services/api'

const OCCASIONS = ['ANY', 'SCHOOL', 'WORK', 'GYM', 'PARTY', 'DATE', 'OUTDOOR', 'EVERYDAY']
const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

type OutfitItem = { id: string; category: string; clothing_name: string; color: string | null; style: string | null; image_url: string | null }
type Outfit = { id: string; occasion: string | null; score: number; reasons: string[]; is_saved: boolean; is_worn: boolean; items: OutfitItem[] }

async function generate(occasion: string) {
  const { data } = await api.get<{ data: Outfit[] }>('/outfits/generate', { params: occasion === 'ANY' ? {} : { occasion } })
  return data.data
}

export default function OutfitGenerator() {
  const [occasion, setOccasion] = useState('ANY')
  const [requested, setRequested] = useState(false)
  const queryClient = useQueryClient()
  const outfits = useQuery({ queryKey: ['outfits', occasion, requested], queryFn: () => generate(occasion), enabled: requested })
  const feedback = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => api.patch(`/outfits/${id}/feedback`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['outfits'] }),
  })
  const request = () => { setRequested(false); queueMicrotask(() => setRequested(true)) }

  return <div className="ss-page-wrapper" style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
    <h1 style={{ fontFamily: FH, fontSize: 32, color: 'var(--text-heading)', marginBottom: 6 }}>Outfit Generator</h1>
    <p className="page-subtitle" style={{ marginBottom: 26 }}>Personalized combinations from your clean wardrobe items.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
      {OCCASIONS.map((value) => <button key={value} onClick={() => setOccasion(value)} style={{ fontFamily: FF, border: '1px solid var(--border-solid)', borderRadius: 9, padding: '7px 12px', cursor: 'pointer', background: occasion === value ? 'var(--accent)' : 'var(--bg-card)', color: occasion === value ? '#fff' : 'var(--text-body)' }}>{value === 'ANY' ? 'Any occasion' : value}</button>)}
    </div>
    <button onClick={request} disabled={outfits.isFetching} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontFamily: FF, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 0, borderRadius: 10, padding: '12px 18px', cursor: 'pointer', marginBottom: 28 }}><Sparkles size={17} />{outfits.isFetching ? 'Generating…' : 'Generate outfits'}</button>
    {outfits.isError && <p style={{ color: '#e03a3a', fontFamily: FF }}>Could not generate outfits. Confirm the API and Supabase migration are running.</p>}
    {requested && !outfits.isFetching && !outfits.isError && !outfits.data?.length && <div style={{ textAlign: 'center', padding: 50 }}><Shirt size={35} /><p style={{ fontFamily: FF }}>Add at least one clean top and bottom to generate an outfit.</p></div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 18 }}>
      {outfits.data?.map((outfit) => <div key={outfit.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-solid)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontFamily: FF }}>Match {Math.round(outfit.score)}%</strong><span style={{ fontFamily: FF, fontSize: 12 }}>{outfit.occasion || 'Any occasion'}</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${outfit.items.length}, 1fr)` }}>{outfit.items.map((item) => <div key={item.id} style={{ padding: 10, textAlign: 'center', borderTop: '1px solid var(--border-solid)' }}>{item.image_url ? <img src={item.image_url} alt={item.clothing_name} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 9 }} /> : <Shirt size={32} />}<div style={{ fontFamily: FF, fontSize: 12 }}>{item.clothing_name}</div><div style={{ fontFamily: FF, fontSize: 10, color: 'var(--text-muted)' }}>{item.category}</div></div>)}</div>
        <div style={{ padding: 14, fontFamily: FF, fontSize: 12, color: 'var(--text-muted)' }}>{outfit.reasons.map((reason) => <div key={reason}>• {reason}</div>)}</div>
        <div style={{ padding: '0 14px 14px', display: 'flex', gap: 8 }}><button onClick={() => feedback.mutate({ id: outfit.id, patch: { isSaved: !outfit.is_saved } })} style={{ flex: 1, border: 0, borderRadius: 8, padding: 9, cursor: 'pointer' }}><Heart size={15} fill={outfit.is_saved ? 'currentColor' : 'none'} /> Save</button><button onClick={() => feedback.mutate({ id: outfit.id, patch: { isWorn: true } })} disabled={outfit.is_worn} style={{ flex: 1, border: 0, borderRadius: 8, padding: 9, cursor: 'pointer' }}><Check size={15} /> {outfit.is_worn ? 'Worn' : 'Mark worn'}</button></div>
      </div>)}
    </div>
  </div>
}
