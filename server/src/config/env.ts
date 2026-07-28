import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from src/server/.env
dotenv.config({ path: path.join(process.cwd(), 'src', 'server', '.env') })

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_min_length',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_min_length',
  SUPABASE_URL: process.env.VITE_SUPABASE_URL || 'https://wdvndocbxxzpltywtpub.supabase.co',
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
}

