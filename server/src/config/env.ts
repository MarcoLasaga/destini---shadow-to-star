import dotenv from 'dotenv'
import path from 'path'

// Local server overrides are optional; the workspace .env remains the fallback.
dotenv.config({ path: [path.join(process.cwd(), 'server', '.env'), path.join(process.cwd(), '.env')] })

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_min_length',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_min_length',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://wdvndocbxxzpltywtpub.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
  // URL of the separately deployed clothing CNN. It receives a normalized image body
  // and returns category, color, style and optional confidence scores.
  CNN_ANALYSIS_URL: process.env.CNN_ANALYSIS_URL || '',
}

