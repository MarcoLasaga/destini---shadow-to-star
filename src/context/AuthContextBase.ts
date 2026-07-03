import { createContext } from 'react'

export type UserRole = 'admin' | 'user'

export interface UserProfile {
  name:           string
  email:          string
  memberSince:    string
  avatarUrl?:     string
  preferredStyle: string
  size:           string
  age:            string
  gender:         string
  bodyType:       string
  styles:         string[]
  colors:         string[]
  occasions:      string[]
  role:           UserRole
}

export interface AuthCtx {
  isLoggedIn:   boolean
  user:         UserProfile | null
  isAdmin:      boolean
  login:        (u: UserProfile) => void
  logout:       () => void
  updateUser:   (patch: Partial<UserProfile>) => void
}

export const Ctx = createContext<AuthCtx | null>(null)
