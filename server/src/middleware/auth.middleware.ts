import { Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import { sendError } from '../utils/response'
import type { AuthRequest } from '../types'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wdvndocbxxzpltywtpub.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

// Create Supabase client if key is available
const supabase = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required', 401)
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return sendError(res, 'Authentication token missing', 401)
    }

    // 1. Try to verify via Supabase API (online verification)
    if (supabase) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token)
        if (user && !error) {
          req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            token: token,
          }
          return next()
        }
      } catch (err) {
        console.warn('Supabase online auth check failed, falling back to decoding JWT:', err)
      }
    }

    // 2. Fallback to decoding JWT directly (offline/dev support)
    try {
      const decoded = jwt.decode(token) as any
      if (decoded && decoded.sub) {
        req.user = {
          userId: decoded.sub,
          email: decoded.email,
          role: decoded.role || 'authenticated',
          token: token,
        }
        return next()
      }
    } catch (err) {
      console.error('JWT decode fallback failed:', err)
    }

    return sendError(res, 'Invalid or expired authentication token', 401)
  } catch (error) {
    next(error)
  }
}
