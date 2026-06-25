import { useContext } from 'react'
import { WardrobeContext } from './WardrobeContextBase'

export function useWardrobe() {
  const ctx = useContext(WardrobeContext)
  if (!ctx) throw new Error('useWardrobe must be used inside WardrobeProvider')
  return ctx
}
