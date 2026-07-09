import path from 'path'
import fs from 'fs'
import { ENV } from './env'

// ── Storage interface — implement Cloudinary later ─────────────────────────────
export interface UploadResult {
  url: string
  publicId: string
}

// ── Local storage (dev/fallback) ───────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

export const uploadService = {
  async uploadBuffer(buffer: Buffer, filename: string, _mimetype: string): Promise<UploadResult> {
    // TODO: swap this block with Cloudinary upload when ready
    // const result = await cloudinary.uploader.upload_stream(...)

    const safeName = `${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '_')}`
    const filepath = path.join(UPLOAD_DIR, safeName)
    fs.writeFileSync(filepath, buffer)

    const baseUrl = `http://localhost:${ENV.PORT}`
    return {
      url: `${baseUrl}/uploads/${safeName}`,
      publicId: safeName,
    }
  },

  async deleteFile(publicId: string): Promise<void> {
    // TODO: swap with Cloudinary delete
    const filepath = path.join(UPLOAD_DIR, publicId)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
  },
}
