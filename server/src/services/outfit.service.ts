import { getSupabaseClient } from '../config/supabase'

type WardrobeRow = {
  id: string; category: string; clothing_name: string; color: string | null; style: string | null
  occasion: string | null; image_url: string | null; laundry_status: string; last_worn_at: string | null
}

type PreferenceProfile = { style_weights: Record<string, number>; color_weights: Record<string, number>; occasion_weights: Record<string, number>; category_weights: Record<string, number>; disliked_items: string[] }

const NEUTRALS = new Set(['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown', 'cream', 'khaki'])

function scoreCombination(items: WardrobeRow[], occasion?: string, preferences?: PreferenceProfile) {
  let score = 55
  const reasons: string[] = []
  const styles = items.map((item) => item.style).filter(Boolean)
  if (styles.length > 1 && new Set(styles).size === 1) { score += 18; reasons.push('Matching style') }
  if (occasion && occasion !== 'ANY' && items.some((item) => item.occasion === occasion)) { score += 15; reasons.push(`Suitable for ${occasion.toLowerCase()}`) }
  const styleWeight = styles.reduce((sum, style) => sum + (preferences?.style_weights[style!] || 0), 0)
  const colorWeight = items.reduce((sum, item) => sum + (preferences?.color_weights[item.color?.toUpperCase() || ''] || 0), 0)
  const categoryWeight = items.reduce((sum, item) => sum + (preferences?.category_weights[item.category] || 0), 0)
  const occasionWeight = occasion ? (preferences?.occasion_weights[occasion] || 0) : 0
  if (styleWeight > 0) { score += Math.min(styleWeight, 15); reasons.push('Matches your preferred style') }
  if (colorWeight > 0) { score += Math.min(colorWeight, 10); reasons.push('Uses colors you tend to like') }
  if (categoryWeight > 0) { score += Math.min(categoryWeight, 8); reasons.push('Uses clothing types you prefer') }
  if (occasionWeight > 0) { score += Math.min(occasionWeight, 10); reasons.push('Fits your occasion preference') }
  if (items.some((item) => NEUTRALS.has(item.color?.toLowerCase() || ''))) { score += 10; reasons.push('Neutral color anchor') }
  const recentlyWorn = items.some((item) => item.last_worn_at && Date.now() - new Date(item.last_worn_at).getTime() < 7 * 86400000)
  if (recentlyWorn) { score -= 18; reasons.push('Includes a recently worn item') } else reasons.push('Avoids recently worn items')
  const disliked = new Set(preferences?.disliked_items || [])
  if (items.some((item) => disliked.has(item.id))) { score -= 30; reasons.push('Avoids items you disliked less effectively') }
  return { score: Math.max(0, Math.min(score, 100)), reasons }
}

function combinations(items: WardrobeRow[], occasion?: string, preferences?: PreferenceProfile) {
  const clean = items.filter((item) => item.laundry_status === 'CLEAN')
  const tops = clean.filter((item) => item.category === 'TOP')
  const bottoms = clean.filter((item) => item.category === 'BOTTOM')
  const shoes = clean.filter((item) => item.category === 'SHOES')
  const accessories = clean.filter((item) => item.category === 'ACCESSORIES')
  const results: { items: WardrobeRow[]; score: number; reasons: string[] }[] = []
  for (const top of tops) for (const bottom of bottoms) {
    const base = [top, bottom, shoes.find((shoe) => shoe.style === top.style) || shoes[0], accessories[0]].filter(Boolean) as WardrobeRow[]
    const result = scoreCombination(base, occasion, preferences)
    results.push({ items: base, ...result })
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 3)
}

export const outfitService = {
  async generate(userId: string, occasion: string | undefined, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data: wardrobe, error } = await supabase.from('wardrobe_items').select('id, category, clothing_name, color, style, occasion, image_url, laundry_status, last_worn_at').eq('user_id', userId)
    if (error) throw error
    const { data: preference } = await supabase.from('preference_profiles').select('*').eq('user_id', userId).maybeSingle()
    const generated = combinations((wardrobe || []) as WardrobeRow[], occasion, preference as PreferenceProfile | undefined)
    if (!generated.length) return []
    const rows = generated.map((outfit) => ({ user_id: userId, occasion: occasion || null, item_ids: outfit.items.map((item) => item.id), score: outfit.score, reasons: outfit.reasons }))
    const { data, error: insertError } = await supabase.from('outfit_recommendations').insert(rows).select()
    if (insertError) throw insertError
    return (data || []).map((row) => ({ ...row, items: generated.find((outfit) => outfit.items.map((item) => item.id).join(',') === row.item_ids.join(','))?.items || [] }))
  },

  async history(userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data, error } = await supabase.from('outfit_recommendations').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    const rows = data || []
    const ids = [...new Set(rows.flatMap((row) => row.item_ids || []))]
    const { data: items, error: itemsError } = await supabase.from('wardrobe_items').select('id, clothing_name, category, image_url, color').eq('user_id', userId).in('id', ids)
    if (itemsError) throw itemsError
    return rows.map((row) => ({ ...row, items: (items || []).filter((item) => (row.item_ids || []).includes(item.id)) }))
  },

  async updateFeedback(id: string, userId: string, input: { isSaved?: boolean; isWorn?: boolean; rating?: number; note?: string; eventType?: string }, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data: existing, error: existingError } = await supabase.from('outfit_recommendations').select('item_ids, is_worn, occasion').eq('id', id).eq('user_id', userId).maybeSingle()
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
    const eventType = input.eventType || (input.rating ? 'RATING' : input.isWorn ? 'WORN' : input.isSaved === false ? 'UNSAVE' : 'SAVE')
    await supabase.from('preference_events').insert({ user_id: userId, recommendation_id: id, event_type: eventType, rating: input.rating ?? null, note: input.note ?? null, occasion: existing.occasion ?? null, item_ids: existing.item_ids })
    if (input.rating !== undefined || eventType === 'LIKE' || eventType === 'DISLIKE') {
      const { data: profile } = await supabase.from('preference_profiles').select('*').eq('user_id', userId).maybeSingle()
      const next = profile || { user_id: userId, style_weights: {}, color_weights: {}, occasion_weights: {}, category_weights: {}, disliked_items: [], feedback_count: 0 }
      next.feedback_count = (next.feedback_count || 0) + 1
      const delta = eventType === 'DISLIKE' || (input.rating !== undefined && input.rating <= 2) ? -1 : 1
      next.occasion_weights = { ...(next.occasion_weights || {}) }
      if (existing.occasion) next.occasion_weights[existing.occasion] = Math.max(-10, Math.min(10, (next.occasion_weights[existing.occasion] || 0) + delta))
      const { data: feedbackItems } = await supabase.from('wardrobe_items').select('id, category, color, style').eq('user_id', userId).in('id', existing.item_ids || [])
      for (const item of feedbackItems || []) {
        next.style_weights = { ...(next.style_weights || {}) }
        next.color_weights = { ...(next.color_weights || {}) }
        next.category_weights = { ...(next.category_weights || {}) }
        if (item.style) next.style_weights[item.style] = Math.max(-10, Math.min(10, (next.style_weights[item.style] || 0) + delta))
        if (item.color) next.color_weights[item.color.toUpperCase()] = Math.max(-10, Math.min(10, (next.color_weights[item.color.toUpperCase()] || 0) + delta))
        if (item.category) next.category_weights[item.category] = Math.max(-10, Math.min(10, (next.category_weights[item.category] || 0) + delta))
        if (delta < 0 && !next.disliked_items.includes(item.id)) next.disliked_items = [...next.disliked_items, item.id].slice(-50)
      }
      await supabase.from('preference_profiles').upsert({ ...next, updated_at: new Date().toISOString() })
    }
    return data
  },
}
