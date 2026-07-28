import { getSupabaseClient } from '../config/supabase'
import type { CreateItemInput, UpdateItemInput, FilterInput } from '../validators/wardrobe.validator'

function toSnakeCol(col: string): string {
  if (col === 'createdAt') return 'created_at'
  if (col === 'clothingName') return 'clothing_name'
  if (col === 'imageUrl') return 'image_url'
  if (col === 'isFavorite') return 'is_favorite'
  if (col === 'laundryStatus') return 'laundry_status'
  if (col === 'wearCount') return 'wear_count'
  if (col === 'washCount') return 'wash_count'
  if (col === 'lastWornAt') return 'last_worn_at'
  if (col === 'lastWashedAt') return 'last_washed_at'
  if (col === 'estimatedPrice') return 'estimated_price'
  return col.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

function toCamel(row: any) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    category: row.category,
    subcategory: row.subcategory,
    clothingName: row.clothing_name,
    color: row.color,
    material: row.material,
    brand: row.brand,
    style: row.style,
    occasion: row.occasion,
    season: row.season,
    size: row.size,
    estimatedPrice: row.estimated_price ? parseFloat(row.estimated_price) : null,
    notes: row.notes,
    isFavorite: row.is_favorite,
    laundryStatus: row.laundry_status,
    wearCount: row.wear_count,
    washCount: row.wash_count,
    lastWornAt: row.last_worn_at ? new Date(row.last_worn_at) : null,
    lastWashedAt: row.last_washed_at ? new Date(row.last_washed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    seasons: row.seasons || [],
    occasions: row.occasions || []
  }
}

export const wardrobeRepository = {
  async findAll(userId: string, filters: FilterInput, token?: string) {
    const { category, style, occasion, season, laundryStatus, isFavorite, search, sortBy, sortDir, page, limit } = filters
    const supabase = await getSupabaseClient(token)

    let query = supabase
      .from('wardrobe_items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    if (category) query = query.eq('category', category)
    if (style) query = query.eq('style', style)
    if (occasion) query = query.eq('occasion', occasion)
    if (season) query = query.eq('season', season)
    if (laundryStatus) query = query.eq('laundry_status', laundryStatus)
    if (isFavorite !== undefined) query = query.eq('is_favorite', isFavorite)

    if (search) {
      query = query.or(`clothing_name.ilike.%${search}%,brand.ilike.%${search}%,color.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    const sortCol = sortBy ? toSnakeCol(sortBy) : 'created_at'
    const ascending = sortDir === 'asc'

    const currentPage = page ?? 1
    const currentLimit = limit ?? 20
    const from = (currentPage - 1) * currentLimit
    const to = from + currentLimit - 1

    const { data, count, error } = await query
      .order(sortCol, { ascending })
      .range(from, to)

    if (error) throw error

    const items = (data || []).map(toCamel)
    const total = count || 0

    return {
      items,
      total,
      page: currentPage,
      limit: currentLimit,
      totalPages: Math.ceil(total / currentLimit)
    }
  },

  async findById(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error
    return data ? toCamel(data) : null
  },

  async create(userId: string, data: CreateItemInput, imageUrl?: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const row = {
      user_id: userId,
      image_url: imageUrl || null,
      category: data.category,
      subcategory: data.subcategory || null,
      clothing_name: data.clothingName,
      color: data.color || null,
      material: data.material || null,
      brand: data.brand || null,
      style: data.style || null,
      occasion: data.occasion || null,
      season: data.season || null,
      size: data.size || null,
      estimated_price: data.estimatedPrice !== undefined ? data.estimatedPrice : null,
      notes: data.notes || null,
      is_favorite: false,
      laundry_status: 'CLEAN',
      wear_count: 0,
      wash_count: 0,
      seasons: data.season ? [data.season] : [],
      occasions: data.occasion ? [data.occasion] : []
    }

    const { data: inserted, error } = await supabase
      .from('wardrobe_items')
      .insert(row)
      .select()
      .single()

    if (error) throw error
    return toCamel(inserted)
  },

  async update(id: string, userId: string, data: UpdateItemInput, imageUrl?: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const updates: any = {}

    if (imageUrl !== undefined) updates.image_url = imageUrl
    if (data.category !== undefined) updates.category = data.category
    if (data.subcategory !== undefined) updates.subcategory = data.subcategory
    if (data.clothingName !== undefined) updates.clothing_name = data.clothingName
    if (data.color !== undefined) updates.color = data.color
    if (data.material !== undefined) updates.material = data.material
    if (data.brand !== undefined) updates.brand = data.brand
    if (data.style !== undefined) updates.style = data.style
    if (data.occasion !== undefined) {
      updates.occasion = data.occasion
      updates.occasions = data.occasion ? [data.occasion] : []
    }
    if (data.season !== undefined) {
      updates.season = data.season
      updates.seasons = data.season ? [data.season] : []
    }
    if (data.size !== undefined) updates.size = data.size
    if (data.estimatedPrice !== undefined) updates.estimated_price = data.estimatedPrice
    if (data.notes !== undefined) updates.notes = data.notes

    updates.updated_at = new Date().toISOString()

    const { data: updated, error } = await supabase
      .from('wardrobe_items')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return updated ? toCamel(updated) : null
  },

  async delete(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const existing = await wardrobeRepository.findById(id, userId, token)
    if (!existing) return null

    const { error } = await supabase
      .from('wardrobe_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return existing
  },

  async toggleFavorite(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const item = await wardrobeRepository.findById(id, userId, token)
    if (!item) return null

    const { data: updated, error } = await supabase
      .from('wardrobe_items')
      .update({ is_favorite: !item.isFavorite, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return updated ? toCamel(updated) : null
  },

  async markClean(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const item = await wardrobeRepository.findById(id, userId, token)
    if (!item) return null

    const { data: updated, error } = await supabase
      .from('wardrobe_items')
      .update({
        laundry_status: 'CLEAN',
        wash_count: item.washCount + 1,
        last_washed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return updated ? toCamel(updated) : null
  },

  async incrementWear(id: string, userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const item = await wardrobeRepository.findById(id, userId, token)
    if (!item) return null

    const newWearCount = item.wearCount + 1
    let laundryStatus = item.laundryStatus
    if (newWearCount % 5 === 0) laundryStatus = 'NEEDS_WASHING'
    else if (newWearCount % 3 === 0) laundryStatus = 'NEEDS_WASHING_SOON'

    const { data: updated, error } = await supabase
      .from('wardrobe_items')
      .update({
        wear_count: newWearCount,
        last_worn_at: new Date().toISOString(),
        laundry_status: laundryStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error
    return updated ? toCamel(updated) : null
  },

  async countByUser(userId: string, token?: string) {
    const supabase = await getSupabaseClient(token)
    const { count, error } = await supabase
      .from('wardrobe_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) throw error
    return count || 0
  },
}
