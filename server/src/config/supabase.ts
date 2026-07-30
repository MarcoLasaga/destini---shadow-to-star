import { createClient } from '@supabase/supabase-js'
import { ENV } from './env'

export async function getSupabaseClient(token?: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || ENV.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.SUPABASE_KEY

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    // Forward the caller's JWT to PostgREST. This is what makes auth.uid()
    // available to Supabase RLS policies; a publishable key alone is anonymous.
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })

  return client
}
