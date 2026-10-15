import axios from 'axios'
import sharp from 'sharp'
import { ENV } from '../config/env'

const CATEGORIES = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
const STYLES = ['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'] as const

export interface ColorClusterInfo {
  color_name: string
  proportion: number
  lab: [number, number, number] | number[]
}

export interface ClothingPrediction {
  category?: (typeof CATEGORIES)[number]
  categoryConfidence?: number
  color?: string
  secondary_color?: string | null
  palette?: ColorClusterInfo[] | Record<string, unknown> | unknown
  style?: (typeof STYLES)[number]
  confidence?: number
  is_safe_garment?: boolean
  moderation_reason?: string | null
  attributes?: Record<string, unknown> | null
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
    const analysisUrl = ENV.CNN_ANALYSIS_URL
    if (!analysisUrl) {
      throw Object.assign(new Error('Image analysis is not configured. Set CNN_ANALYSIS_URL to the deployed clothing classifier.'), { statusCode: 503, isOperational: true })
    }

    const normalized = await preprocessForCnn(file.buffer)
    const { data } = await axios.post<unknown>(analysisUrl, normalized, {
      headers: { 'Content-Type': 'image/jpeg', 'X-Source-Filename': encodeURIComponent(file.originalname) },
      timeout: 15_000,
    })
    const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
    const confidence = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 ? result.confidence : undefined

    return {
      category: optionalEnum(result.category, CATEGORIES),
      categoryConfidence: confidence,
      color: typeof result.color === 'string' && result.color.length <= 50 ? result.color : undefined,
      secondary_color: typeof result.secondary_color === 'string'
        ? result.secondary_color
        : (result.secondary_color === null ? null : undefined),
      palette: result.palette as any,
      style: optionalEnum(result.style, STYLES),
      confidence,
      is_safe_garment: typeof result.is_safe_garment === 'boolean' ? result.is_safe_garment : true,
      moderation_reason: typeof result.moderation_reason === 'string'
        ? result.moderation_reason
        : (result.moderation_reason === null ? null : undefined),
      attributes: result.attributes && typeof result.attributes === 'object' ? result.attributes as Record<string, unknown> : null,
    }
  },
}
