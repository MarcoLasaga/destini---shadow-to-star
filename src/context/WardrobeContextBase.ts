import { createContext } from 'react'
import type { ClothingItem } from '../types/wardrobe'

export type WardrobeContextType = {
  items: ClothingItem[]
  setItems: (items: ClothingItem[]) => void
  addItem: (item: ClothingItem) => void
  loadSamples: () => void
}

export const WardrobeContext = createContext<WardrobeContextType | null>(null)
