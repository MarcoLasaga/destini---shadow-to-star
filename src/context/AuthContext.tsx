import { useState, useEffect, type ReactNode } from 'react'
import { Ctx } from './AuthContextBase'
import type { UserProfile, UserRole, AuthCtx } from './AuthContextBase'
import { supabase } from '../integrations/supabase/client'

export type { UserRole, UserProfile, AuthCtx }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string, email: string): Promise<UserProfile | null> {
    try {
      // 1. Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)

      const roles = rolesData?.map(r => r.role as string) || []
      const role = roles.includes('admin') ? 'admin' as UserRole : 'user' as UserRole

      // 2. Fetch profile details
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, current_size, preferred_styles, created_at')
        .eq('id', userId)
        .maybeSingle()

      let avatarUrl = profileData?.avatar_url || undefined

      // Synchronize avatar from OAuth metadata if missing in DB profiles
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const oauthAvatar = authUser?.user_metadata?.avatar_url || authUser?.user_metadata?.picture
      if (!avatarUrl && oauthAvatar) {
        avatarUrl = oauthAvatar
        await supabase
          .from('profiles')
          .update({ avatar_url: oauthAvatar })
          .eq('id', userId)
      }

      // Format memberSince (e.g. "Jul 2026")
      let memberSince = 'Jul 2026'
      if (profileData?.created_at) {
        const date = new Date(profileData.created_at)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        memberSince = `${months[date.getMonth()]} ${date.getFullYear()}`
      }

      return {
        name: profileData?.display_name || email.split('@')[0],
        email: email,
        memberSince: memberSince,
        avatarUrl: avatarUrl,
        preferredStyle: profileData?.preferred_styles?.[0] || 'Casual',
        size: profileData?.current_size || 'M',
        age: '22',
        gender: 'Prefer-Not-To-Say',
        bodyType: 'Average',
        styles: profileData?.preferred_styles || ['Casual'],
        colors: ['Black', 'White'],
        occasions: ['Everyday'],
        role: role,
      }
    } catch (e) {
      console.error('Error fetching profile:', e)
      return null
    }
  }

  useEffect(() => {
    // Check session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const p = await fetchProfile(session.user.id, session.user.email || '')
        setUser(p)
        setIsLoggedIn(true)
      } else {
        setUser(null)
        setIsLoggedIn(false)
      }
      setLoading(false)
    })

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const p = await fetchProfile(session.user.id, session.user.email || '')
        setUser(p)
        setIsLoggedIn(true)
      } else {
        setUser(null)
        setIsLoggedIn(false)
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  function login(u: UserProfile) {
    setUser(u)
    setIsLoggedIn(true)
  }

  async function logout() {
    await supabase.auth.signOut()
    setUser(null)
    setIsLoggedIn(false)
  }

  async function updateUser(patch: Partial<UserProfile>) {
    setUser(prev => {
      if (!prev) return null
      return { ...prev, ...patch }
    })
    
    // Also push updates to database if name, size, styles changed
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    
    const dbUpdate: any = {}
    if (patch.name !== undefined) dbUpdate.display_name = patch.name
    if (patch.size !== undefined) dbUpdate.current_size = patch.size
    if (patch.styles !== undefined) dbUpdate.preferred_styles = patch.styles
    if (patch.avatarUrl !== undefined) dbUpdate.avatar_url = patch.avatarUrl
    
    if (Object.keys(dbUpdate).length > 0) {
      await supabase
        .from('profiles')
        .update(dbUpdate)
        .eq('id', authUser.id)
    }
  }

  const isAdmin = isLoggedIn && user?.role === 'admin'

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#faf7f2', color: '#2b1f0e', fontFamily: 'Baloo Tamma 2, sans-serif' }}>
        Loading session...
      </div>
    )
  }

  return (
    <Ctx.Provider value={{ isLoggedIn, user, isAdmin, login, logout, updateUser }}>
      {children}
    </Ctx.Provider>
  )
}