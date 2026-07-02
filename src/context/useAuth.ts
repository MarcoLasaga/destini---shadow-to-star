import { useContext } from 'react'
import { Ctx } from './AuthContextBase'

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
