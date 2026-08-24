import { Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { sendError } from '../utils/response'
import type { AuthRequest } from '../types'

const ADMIN_EMAIL = 'admin@stylesense.com'
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wdvndocbxxzpltywtpub.supabase.co'
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = req.user?.token
    if (!token || !supabase) return sendError(res, 'Admin authentication is unavailable', 401)

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return sendError(res, 'Administrator access required', 403)
    }

    const { data: role, error: roleError } = await createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()

    if (roleError || !role) return sendError(res, 'Administrator role is not assigned', 403)
    req.user = { ...req.user, userId: user.id, email: user.email, role: 'admin', token }
    return next()
  } catch (error) {
    return next(error)
  }
}
