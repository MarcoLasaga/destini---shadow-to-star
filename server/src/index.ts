import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import path from 'path'
import { ENV } from './config/env'
import { errorHandler } from './middleware/errorHandler'
import wardrobeRoutes from './routes/wardrobe.routes'
import outfitRoutes from './routes/outfit.routes'

const app = express()

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }))

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// ── Static uploads ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ success: true, message: 'StyleSense API', ts: new Date() }))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/wardrobe', wardrobeRoutes)
app.use('/api/outfits', outfitRoutes)

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }))

// ── Error ─────────────────────────────────────────────────────────────────────
app.use(errorHandler)

app.listen(ENV.PORT, () => {
  console.log(`\n🚀 StyleSense API → http://localhost:${ENV.PORT}`)
  console.log(`📁 Uploads       → http://localhost:${ENV.PORT}/uploads\n`)
})

export default app
