import { createContext } from 'react'

export interface UserProfile {
  name:         string
  email:        string
  memberSince:  string
  avatarUrl?:   string
  preferredStyle: string
  size:         string
  age:          string
  gender:       string
  bodyType:     string
  styles:       string[]
  colors:       string[]
  occasions:    string[]
}

export interface AuthCtx {
  isLoggedIn:   boolean
  user:         UserProfile | null
  login:        (u: UserProfile) => void
  logout:       () => void
  updateUser:   (patch: Partial<UserProfile>) => void
}

export const Ctx = createContext<AuthCtx | null>(null)
