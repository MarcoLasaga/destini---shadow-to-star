import { getSupabaseClient } from '../config/supabase'

export const DATASET_CATEGORIES = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
export const DATASET_TARGET = 200
export type DatasetStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export const datasetRepository = {
  async getApprovedManifest(token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('id, image_url, category, clothing_name, dataset_split')
      .eq('dataset_status', 'APPROVED')
      .not('image_url', 'is', null)
      .in('category', DATASET_CATEGORIES)
      .order('category')
    if (error) throw error
    return { generatedAt: new Date().toISOString(), items: data || [] }
  },

  async getOverview(token?: string) {
    const supabase = await getSupabaseClient(token)
    const { data, error } = await supabase
      .from('wardrobe_items')
      .select('id, user_id, image_url, category, clothing_name, color, material, brand, style, occasion, season, subcategory, notes, created_at, dataset_status, dataset_split, dataset_review_note')
      .in('category', DATASET_CATEGORIES)
      .order('created_at', { ascending: false })

    if (error) throw error
    const rows = data || []
    const categories = DATASET_CATEGORIES.map(category => {
      const approved = rows.filter(row => row.category === category && row.dataset_status === 'APPROVED')
      return {
        category,
        pending: rows.filter(row => row.category === category && row.dataset_status === 'PENDING').length,
        approved: approved.length,
        rejected: rows.filter(row => row.category === category && row.dataset_status === 'REJECTED').length,
        validation: approved.filter(row => row.dataset_split === 'VALIDATION').length,
        target: DATASET_TARGET,
        // train.py creates a stratified validation split from the approved corpus.
        ready: approved.length >= DATASET_TARGET,
      }
    })

    return {
      targetPerCategory: DATASET_TARGET,
      categories,
      pending: rows.filter(row => row.dataset_status === 'PENDING').slice(0, 100),
      totals: {
        pending: rows.filter(row => row.dataset_status === 'PENDING').length,
        approved: rows.filter(row => row.dataset_status === 'APPROVED').length,
        rejected: rows.filter(row => row.dataset_status === 'REJECTED').length,
      },
      ready: categories.every(category => category.ready),
    }
  },

  async review(id: string, reviewerId: string, status: DatasetStatus, split: 'TRAIN' | 'VALIDATION' | 'TEST' | null, note: string | null, token?: string) {
    const supabase = await getSupabaseClient(token)
    const updates = {
      dataset_status: status,
      dataset_split: status === 'APPROVED' ? (split || 'TRAIN') : null,
      dataset_reviewed_by: status === 'PENDING' ? null : reviewerId,
      dataset_reviewed_at: status === 'PENDING' ? null : new Date().toISOString(),
      dataset_review_note: note,
    }
    const { data, error } = await supabase
      .from('wardrobe_items')
      .update(updates)
      .eq('id', id)
      .select('id, dataset_status, dataset_split, dataset_review_note')
      .single()
    if (error) throw error
    return data
  },
}
