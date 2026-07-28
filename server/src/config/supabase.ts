import { createClient } from '@supabase/supabase-js'
import { ENV } from './env'

export function getSupabaseClient(token?: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || ENV.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.SUPABASE_KEY

  if (token) {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    })
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })
}
