import { createContext } from 'react'
import type { ClothingItem } from '../types/wardrobe'

export interface WardrobeContextType {
  items: ClothingItem[]
  setItems: (items: ClothingItem[]) => void
  addItem: (item: ClothingItem) => void
  loadSamples: () => void
  getItem: (id: string) => ClothingItem | undefined
  markOutfitWorn: (itemIds: string[]) => void
  toggleFavorite: (id: string) => void
  updateLaundryStatus: (id: string, status: ClothingItem['laundryStatus']) => void
  updateCost: (id: string, cost: number | null) => void
  removeItem: (id: string) => void
}

export const WardrobeContext = createContext<WardrobeContextType | null>(null)
