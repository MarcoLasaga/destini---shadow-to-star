import { useState, type ReactNode } from 'react'
import { Ctx, type UserProfile } from './AuthContextBase'

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
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start as logged in with mock data so the profile page is immediately visible
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [user, setUser]             = useState<UserProfile | null>(MOCK_USER)

  function login(u: UserProfile)                  { setUser(u); setIsLoggedIn(true) }
  function logout()                               { setUser(null); setIsLoggedIn(false) }
  function updateUser(patch: Partial<UserProfile>){ setUser(prev => prev ? { ...prev, ...patch } : prev) }

  return (
    <Ctx.Provider value={{ isLoggedIn, user, login, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  )
}

// `useAuth` is provided in a separate module to keep this file's exports
// focused on the provider and types (improves fast refresh behavior).