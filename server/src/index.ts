import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { ENV } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth.routes'
import profileRoutes from './routes/profile.routes'
import adminRoutes from './routes/admin.routes'
import wardrobeRoutes from './routes/wardrobe.routes'

const app = express()

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))

// ── Rate limiting ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { success: false, message: 'Too many requests' } })

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ success: true, message: 'StyleSense API', ts: new Date() }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/wardrobe', wardrobeRoutes)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }))

// ── Error ─────────────────────────────────────────────────────────────────────
app.use(errorHandler)

app.listen(ENV.PORT, () => {
  console.log(`\n🚀 StyleSense API → http://localhost:${ENV.PORT}`)
  console.log(`📁 Uploads       → http://localhost:${ENV.PORT}/uploads\n`)
})

export default app
