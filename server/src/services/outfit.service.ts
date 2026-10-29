import crypto from 'crypto'
import { getSupabaseClient } from '../config/supabase'

type WardrobeRow = {
  id: string
  category: string
  clothing_name: string
  color: string | null
  style: string | null
  occasion: string | null
  image_url: string | null
  laundry_status: string
  last_worn_at: string | null
}

type PreferenceProfile = {
  style_weights: Record<string, number>
  color_weights: Record<string, number>
  occasion_weights: Record<string, number>
  category_weights: Record<string, number>
  disliked_items: string[]
}

const NEUTRALS = new Set(['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown', 'cream', 'khaki'])

function isUuid(str?: string | null): boolean {
  if (!str) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

function scoreCombination(items: WardrobeRow[], occasion?: string, preferences?: PreferenceProfile) {
  let score = 65
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
  const disliked = new Set(preferences?.disliked_items || [])
  if (items.some((item) => disliked.has(item.id))) { score -= 25; reasons.push('Avoids items you disliked less effectively') }
  return { score: Math.max(0, Math.min(score, 100)), reasons }
}

function combinations(items: WardrobeRow[], occasion?: string, preferences?: PreferenceProfile) {
  const clean = items
  const tops = clean.filter((item) => item.category === 'TOP')
  const bottoms = clean.filter((item) => item.category === 'BOTTOM')
  const shoes = clean.filter((item) => item.category === 'SHOES')
  const accessories = clean.filter((item) => item.category === 'ACCESSORIES')
  const outerwears = clean.filter((item) => item.category === 'OUTERWEAR')
  const results: { items: WardrobeRow[]; score: number; reasons: string[] }[] = []

  for (let tIdx = 0; tIdx < tops.length; tIdx++) {
    const top = tops[tIdx]
    for (let bIdx = 0; bIdx < bottoms.length; bIdx++) {
      const bottom = bottoms[bIdx]
      const shoe = shoes.length > 0 ? (shoes[(tIdx + bIdx) % shoes.length] || shoes[0]) : undefined
      const acc = accessories.length > 0 ? (accessories[(tIdx + bIdx) % accessories.length] || accessories[0]) : undefined
      const outer = (occasion === 'FORMAL' || occasion === 'ACADEMIC') && outerwears.length > 0
        ? outerwears[(tIdx + bIdx) % outerwears.length]
        : undefined
      const base = [top, outer, bottom, shoe, acc].filter(Boolean) as WardrobeRow[]
      const result = scoreCombination(base, occasion, preferences)
      results.push({ items: base, ...result, reasons: [...new Set(result.reasons)] })
    }
  }

  const sorted = results.sort((a, b) => b.score - a.score)
  const selected: typeof sorted = []
  const usedTops = new Set<string>()

  for (const cand of sorted) {
    const topId = cand.items.find((i) => i.category === 'TOP')?.id
    if (selected.length < 3) {
      if (!topId || !usedTops.has(topId) || tops.length <= selected.length) {
        selected.push(cand)
        if (topId) usedTops.add(topId)
      }
    }
  }

  return selected.length >= 3 ? selected : sorted.slice(0, 3)
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
    return rows.map((row) => ({
      ...row,
      is_saved: Boolean(row.is_saved),
      is_favorite: Boolean(row.is_saved),
      items: (items || []).filter((item) => (row.item_ids || []).includes(item.id)),
    }))
  },

  async getSaved(userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data, error } = await supabase
      .from('outfit_recommendations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_saved', true)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    const rows = data || []
    const ids = [...new Set(rows.flatMap((row) => row.item_ids || []))]
    let items: any[] = []
    if (ids.length > 0) {
      const { data: itemData, error: itemsError } = await supabase
        .from('wardrobe_items')
        .select('id, clothing_name, category, image_url, color, style, occasion')
        .eq('user_id', userId)
        .in('id', ids)
      if (!itemsError && itemData) {
        items = itemData
      }
    }
    return rows.map((row) => ({
      ...row,
      is_saved: true,
      is_favorite: true,
      items: (items || []).filter((item) => (row.item_ids || []).includes(item.id)),
    }))
  },

  async saveOutfit(
    userId: string,
    input: {
      id?: string
      item_ids?: string[]
      items?: any[]
      occasion?: string
      score?: number
      reasons?: string[]
      isSaved?: boolean
    },
    token?: string
  ) {
    const supabase = await getSupabaseClient(token)
    const validId = input.id && isUuid(input.id) ? input.id : crypto.randomUUID()
    const rawIds = Array.isArray(input.item_ids) && input.item_ids.length > 0
      ? input.item_ids
      : (Array.isArray(input.items) ? input.items.map((i: any) => i?.id).filter(Boolean) : [])
    const itemIds = rawIds.filter((id) => isUuid(id))

    // Check if outfit already exists
    const { data: existing } = await supabase
      .from('outfit_recommendations')
      .select('id, item_ids')
      .eq('id', validId)
      .eq('user_id', userId)
      .maybeSingle()

    let rowData
    if (existing) {
      const { data, error } = await supabase
        .from('outfit_recommendations')
        .update({
          is_saved: input.isSaved !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validId)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) throw error
      rowData = data
    } else {
      const { data, error } = await supabase
        .from('outfit_recommendations')
        .insert({
          id: validId,
          user_id: userId,
          occasion: input.occasion || null,
          item_ids: itemIds,
          score: typeof input.score === 'number' ? input.score : 85.0,
          reasons: Array.isArray(input.reasons) ? input.reasons : [],
          is_saved: input.isSaved !== false,
          is_worn: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      rowData = data
    }

    // Populate items
    let items: any[] = []
    const ids = rowData?.item_ids || []
    if (ids.length > 0) {
      const { data: itemData } = await supabase
        .from('wardrobe_items')
        .select('id, clothing_name, category, image_url, color, style, occasion')
        .eq('user_id', userId)
        .in('id', ids)
      if (itemData) items = itemData
    }

    return {
      ...rowData,
      is_saved: true,
      is_favorite: true,
      items,
    }
  },

  async deleteOutfit(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    if (!isUuid(id)) {
      return { success: true, message: 'Outfit removed' }
    }
    const { error } = await supabase
      .from('outfit_recommendations')
      .update({ is_saved: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
    return { success: true, message: 'Outfit removed' }
  },

  async updateFeedback(
    id: string,
    userId: string,
    input: { isSaved?: boolean; isWorn?: boolean; rating?: number; note?: string; eventType?: string; item_ids?: string[]; items?: any[]; occasion?: string },
    token?: string
  ) {
    const supabase = await getSupabaseClient(token)

    // Handle temporary non-UUID recommendations (e.g. "rec-1")
    if (!isUuid(id)) {
      return this.saveOutfit(
        userId,
        {
          id: crypto.randomUUID(),
          item_ids: input.item_ids,
          items: input.items,
          occasion: input.occasion,
          isSaved: input.isSaved ?? true,
        },
        token
      )
    }

    const { data: existing, error: existingError } = await supabase
      .from('outfit_recommendations')
      .select('id, item_ids, is_worn, occasion')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()
    if (existingError) throw existingError

    if (!existing) {
      // If client provided a valid UUID not in DB yet, create it as saved
      return this.saveOutfit(
        userId,
        {
          id,
          item_ids: input.item_ids,
          items: input.items,
          occasion: input.occasion,
          isSaved: input.isSaved ?? true,
        },
        token
      )
    }

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

    return {
      ...data,
      is_saved: Boolean(data.is_saved),
      is_favorite: Boolean(data.is_saved),
    }
  },
}
