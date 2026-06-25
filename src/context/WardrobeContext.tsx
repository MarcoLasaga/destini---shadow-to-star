import { useState, type ReactNode } from 'react'
import type { ClothingItem } from '../types/wardrobe'
import { SAMPLE_ITEMS } from './wardrobeSamples'
import { WardrobeContext } from './WardrobeContextBase'

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([])

  function addItem(item: ClothingItem) {
    setItems(prev => [...prev, item])
  }

  function loadSamples() {
    setItems(SAMPLE_ITEMS)
  }

  return (
    <WardrobeContext.Provider value={{ items, setItems, addItem, loadSamples }}>
      {children}
    </WardrobeContext.Provider>
  )
}

