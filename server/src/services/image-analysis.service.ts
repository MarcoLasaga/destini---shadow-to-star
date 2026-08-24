import axios from 'axios'
import sharp from 'sharp'
import { ENV } from '../config/env'

const CATEGORIES = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
const STYLES = ['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'] as const

export interface ClothingPrediction {
  category?: (typeof CATEGORIES)[number]
  color?: string
  style?: (typeof STYLES)[number]
  confidence?: number
}

function optionalEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value.toUpperCase())
    ? value.toUpperCase() as T[number]
    : undefined
}

/**
 * Keeps model input consistent across phone and web uploads: EXIF is applied,
 * dimensions are constrained and RGB JPEG pixels are produced at 224×224.
 */
async function preprocessForCnn(buffer: Buffer) {
  return sharp(buffer, { failOn: 'error' })
    .rotate()
    .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

export const imageAnalysisService = {
  async analyze(file: Express.Multer.File): Promise<ClothingPrediction> {
    if (!ENV.CNN_ANALYSIS_URL) {
      throw Object.assign(new Error('Image analysis is not configured. Set CNN_ANALYSIS_URL to the deployed clothing classifier.'), { statusCode: 503, isOperational: true })
    }

    const normalized = await preprocessForCnn(file.buffer)
    const { data } = await axios.post<unknown>(ENV.CNN_ANALYSIS_URL, normalized, {
      headers: { 'Content-Type': 'image/jpeg', 'X-Source-Filename': encodeURIComponent(file.originalname) },
      timeout: 15_000,
    })
    const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
    const confidence = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 ? result.confidence : undefined

    return {
      category: optionalEnum(result.category, CATEGORIES),
      color: typeof result.color === 'string' && result.color.length <= 50 ? result.color : undefined,
      style: optionalEnum(result.style, STYLES),
      confidence,
    }
  },
}
