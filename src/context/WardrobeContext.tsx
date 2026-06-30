/* eslint-disable react-refresh/only-export-components */
import { useContext, useState, type ReactNode } from 'react'
import type { ClothingItem } from '../types/wardrobe'
import { WardrobeContext } from './WardrobeContextBase'
import { SAMPLE_ITEMS } from './wardrobeSamples'

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClothingItem[]>([])

  function addItem(item: ClothingItem) {
    setItems(prev => [...prev, item])
  }

  function loadSamples() {
    setItems(SAMPLE_ITEMS)
  }

  function getItem(id: string) {
    return items.find(i => i.id === id)
  }

  // Called whenever an outfit is marked as worn — increments wear count,
  // updates lastWorn, and flips laundry status for every item used.
  function markOutfitWorn(itemIds: string[]) {
    const today = new Date().toISOString().slice(0, 10)
    setItems(prev => prev.map(item => {
      if (!itemIds.includes(item.id)) return item
      // Randomly decide Needs Washing vs In Laundry to simulate a realistic workflow
      const nextStatus: ClothingItem['laundryStatus'] = Math.random() > 0.5 ? 'Needs Washing' : 'In Laundry'
      return {
        ...item,
        timesWorn: item.timesWorn + 1,
        lastWorn: today,
        laundryStatus: nextStatus,
      }
    }))
  }

  function toggleFavorite(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, favorited: !i.favorited } : i))
  }

  function updateLaundryStatus(id: string, status: ClothingItem['laundryStatus']) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, laundryStatus: status } : i))
  }

  function updateCost(id: string, cost: number | null) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, cost } : i))
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <WardrobeContext.Provider value={{
      items, setItems, addItem, loadSamples, getItem,
      markOutfitWorn, toggleFavorite, updateLaundryStatus, updateCost, removeItem,
    }}>
      {children}
    </WardrobeContext.Provider>
  )
}

export function useWardrobe() {
  const ctx = useContext(WardrobeContext)
  if (!ctx) throw new Error('useWardrobe must be used inside WardrobeProvider')
  return ctx
}