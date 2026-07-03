import { useState, type ReactNode } from 'react'
import { Ctx } from './AuthContextBase'
import type { UserProfile, UserRole, AuthCtx } from './AuthContextBase'

export type { UserRole, UserProfile, AuthCtx }

const MOCK_USER: UserProfile = {
  name:           'Melgeri',
  email:          'marco@gmail.com',
  memberSince:    'Mar 2026',
  preferredStyle: 'Casual',
  size:           'M',
  age:            '22',
  gender:         'Prefer-Not-To-Say',
  bodyType:       'Average',
  styles:         ['Casual'],
  colors:         ['Black', 'White'],
  occasions:      ['Everyday'],
  role:           'admin',          
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [user, setUser]             = useState<UserProfile | null>(MOCK_USER)

  const isAdmin = isLoggedIn && user?.role === 'admin'

  function login(u: UserProfile)                   { setUser(u); setIsLoggedIn(true) }
  function logout()                                { setUser(null); setIsLoggedIn(false) }
  function updateUser(patch: Partial<UserProfile>) { setUser(prev => prev ? { ...prev, ...patch } : prev) }

  return (
    <Ctx.Provider value={{ isLoggedIn, user, isAdmin, login, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  )
}