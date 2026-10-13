import { api } from '../services/api'

export type DatasetStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type DatasetSplit = 'TRAIN' | 'VALIDATION' | 'TEST'

export interface DatasetCategoryStats {
  category: string
  pending: number
  approved: number
  rejected: number
  validation: number
  target: number
  ready: boolean
}

export interface DatasetReviewItem {
  id: string
  user_id: string
  image_url: string | null
  category: string
  clothing_name: string
  color: string | null
  material: string | null
  brand: string | null
  style: string | null
  occasion: string | null
  season: string | null
  subcategory: string | null
  notes: string | null
  created_at: string
  dataset_status: DatasetStatus
  dataset_split: DatasetSplit | null
  dataset_review_note: string | null
}

export interface DatasetOverview {
  targetPerCategory: number
  categories: DatasetCategoryStats[]
  pending: DatasetReviewItem[]
  totals: { pending: number; approved: number; rejected: number }
  ready: boolean
}

export const adminApi = {
  getDataset: () => api.get<{ data: DatasetOverview }>('/admin/dataset'),
  reviewDatasetItem: (id: string, status: DatasetStatus, split: DatasetSplit = 'TRAIN', note?: string) =>
    api.patch(`/admin/dataset/${id}`, { status, split, note }),
}
