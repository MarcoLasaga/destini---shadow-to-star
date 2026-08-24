import { getSupabaseClient } from '../config/supabase'

type WardrobeRow = {
  id: string; category: string; clothing_name: string; color: string | null; style: string | null
  occasion: string | null; image_url: string | null; laundry_status: string; last_worn_at: string | null
}

const NEUTRALS = new Set(['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown', 'cream', 'khaki'])

function scoreCombination(items: WardrobeRow[], occasion?: string) {
  let score = 55
  const reasons: string[] = []
  const styles = items.map((item) => item.style).filter(Boolean)
  if (styles.length > 1 && new Set(styles).size === 1) { score += 18; reasons.push('Matching style') }
  if (occasion && occasion !== 'ANY' && items.some((item) => item.occasion === occasion)) { score += 15; reasons.push(`Suitable for ${occasion.toLowerCase()}`) }
  if (items.some((item) => NEUTRALS.has(item.color?.toLowerCase() || ''))) { score += 10; reasons.push('Neutral color anchor') }
  const recentlyWorn = items.some((item) => item.last_worn_at && Date.now() - new Date(item.last_worn_at).getTime() < 7 * 86400000)
  if (recentlyWorn) { score -= 18; reasons.push('Includes a recently worn item') } else reasons.push('Avoids recently worn items')
  return { score: Math.max(0, Math.min(score, 100)), reasons }
}

function combinations(items: WardrobeRow[], occasion?: string) {
  const clean = items.filter((item) => item.laundry_status === 'CLEAN')
  const tops = clean.filter((item) => item.category === 'TOP')
  const bottoms = clean.filter((item) => item.category === 'BOTTOM')
  const shoes = clean.filter((item) => item.category === 'SHOES')
  const accessories = clean.filter((item) => item.category === 'ACCESSORIES')
  const results: { items: WardrobeRow[]; score: number; reasons: string[] }[] = []
  for (const top of tops) for (const bottom of bottoms) {
    const base = [top, bottom, shoes.find((shoe) => shoe.style === top.style) || shoes[0], accessories[0]].filter(Boolean) as WardrobeRow[]
    const result = scoreCombination(base, occasion)
    results.push({ items: base, ...result })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 3)
}

export const outfitService = {
  async generate(userId: string, occasion: string | undefined, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data: wardrobe, error } = await supabase.from('wardrobe_items').select('id, category, clothing_name, color, style, occasion, image_url, laundry_status, last_worn_at').eq('user_id', userId)
    if (error) throw error
    const generated = combinations((wardrobe || []) as WardrobeRow[], occasion)
    if (!generated.length) return []
    const rows = generated.map((outfit) => ({ user_id: userId, occasion: occasion || null, item_ids: outfit.items.map((item) => item.id), score: outfit.score, reasons: outfit.reasons }))
    const { data, error: insertError } = await supabase.from('outfit_recommendations').insert(rows).select()
    if (insertError) throw insertError
    return (data || []).map((row) => ({ ...row, items: generated.find((outfit) => outfit.items.map((item) => item.id).join(',') === row.item_ids.join(','))?.items || [] }))
  },

  async updateFeedback(id: string, userId: string, input: { isSaved?: boolean; isWorn?: boolean; rating?: number; note?: string }, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data: existing, error: existingError } = await supabase.from('outfit_recommendations').select('item_ids, is_worn').eq('id', id).eq('user_id', userId).maybeSingle()
    if (existingError) throw existingError
    if (!existing) throw Object.assign(new Error('Outfit recommendation not found'), { statusCode: 404, isOperational: true })
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.isSaved !== undefined) updates.is_saved = input.isSaved
    if (input.isWorn !== undefined) updates.is_worn = input.isWorn
    if (input.rating !== undefined) updates.feedback_rating = input.rating
    if (input.note !== undefined) updates.feedback_note = input.note
    if (input.isWorn && !existing.is_worn) {
      const { data: wornItems, error: wornItemsError } = await supabase.from('wardrobe_items').select('id, wear_count').eq('user_id', userId).in('id', existing.item_ids)
      if (wornItemsError) throw wornItemsError
      const wearUpdates = await Promise.all((wornItems || []).map((item) => {
        const wearCount = item.wear_count + 1
        const laundryStatus = wearCount % 5 === 0 ? 'NEEDS_WASHING' : wearCount % 3 === 0 ? 'NEEDS_WASHING_SOON' : 'CLEAN'
        return supabase.from('wardrobe_items').update({ wear_count: wearCount, last_worn_at: new Date().toISOString(), laundry_status: laundryStatus, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', userId)
      }))
      const failedUpdate = wearUpdates.find((result) => result.error)
      if (failedUpdate?.error) throw failedUpdate.error
    }
    const { data, error } = await supabase.from('outfit_recommendations').update(updates).eq('id', id).eq('user_id', userId).select().maybeSingle()
    if (error) throw error
    if (!data) throw Object.assign(new Error('Outfit recommendation not found'), { statusCode: 404, isOperational: true })
    return data
  },
}
