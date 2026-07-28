import { createClient } from '@supabase/supabase-js'
import { ENV } from './env'

export async function getSupabaseClient(token?: string) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || ENV.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ENV.SUPABASE_KEY

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  })

  if (token) {
    const { error } = await client.auth.setSession({
      access_token: token,
      refresh_token: '',
    })
    if (error) {
      console.error('Error setting Supabase session on backend:', error)
    }
  }

  return client
}
