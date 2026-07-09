import { api as apiClient } from '../services/api'

export interface WardrobeItem {
  id: string
  userId: string
  imageUrl?: string
  category: string
  subcategory?: string
  clothingName: string
  color?: string
  material?: string
  brand?: string
  style?: string
  occasion?: string
  season?: string
  size?: string
  estimatedPrice?: number
  notes?: string
  isFavorite: boolean
  laundryStatus: 'CLEAN' | 'NEEDS_WASHING_SOON' | 'NEEDS_WASHING'
  wearCount: number
  washCount: number
  lastWornAt?: string
  lastWashedAt?: string
  createdAt: string
  updatedAt: string
}

export interface WardrobeListResponse {
  items: WardrobeItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface WardrobeFilters {
  category?: string
  style?: string
  occasion?: string
  season?: string
  laundryStatus?: string
  isFavorite?: boolean
  search?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface CreateItemPayload {
  category: string
  clothingName: string
  subcategory?: string
  color?: string
  material?: string
  brand?: string
  style?: string
  occasion?: string
  season?: string
  size?: string
  estimatedPrice?: number
  notes?: string
}

export const wardrobeApi = {
  getAll: (filters: WardrobeFilters = {}) =>
    apiClient.get<{ data: WardrobeListResponse }>('/wardrobe', { params: filters }),

  getById: (id: string) =>
    apiClient.get<{ data: WardrobeItem }>(`/wardrobe/${id}`),

  create: (payload: CreateItemPayload, image?: File) => {
    const form = new FormData()
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v))
    })
    if (image) form.append('image', image)
    return apiClient.post<{ data: WardrobeItem }>('/wardrobe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  update: (id: string, payload: Partial<CreateItemPayload>, image?: File) => {
    const form = new FormData()
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined && v !== null) form.append(k, String(v))
    })
    if (image) form.append('image', image)
    return apiClient.put<{ data: WardrobeItem }>(`/wardrobe/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  delete: (id: string) =>
    apiClient.delete(`/wardrobe/${id}`),

  toggleFavorite: (id: string) =>
    apiClient.patch<{ data: WardrobeItem; message: string }>(`/wardrobe/${id}/favorite`),

  markClean: (id: string) =>
    apiClient.patch<{ data: WardrobeItem }>(`/wardrobe/${id}/mark-clean`),

  recordWear: (id: string) =>
    apiClient.patch<{ data: WardrobeItem }>(`/wardrobe/${id}/wear`),
}
