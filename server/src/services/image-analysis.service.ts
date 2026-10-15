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

export interface ImageModerationResult {
  is_safe_garment: boolean
  moderation_reason: string | null
  fullSkinRatio: number
  centerSkinRatio: number
  dominantColor: string
  secondaryColor: string | null
  palette: ColorClusterInfo[]
}

const REFERENCE_COLORS_LAB: Record<string, [number, number, number]> = {
  Black: [15.0, 0.0, 0.0],
  White: [95.0, 0.0, 0.0],
  Gray: [55.0, 0.0, 0.0],
  Beige: [82.0, 2.0, 14.0],
  Khaki: [68.0, 1.0, 20.0],
  Navy: [25.0, 8.0, -32.0],
  Blue: [45.0, 5.0, -48.0],
  Red: [48.0, 62.0, 35.0],
  Burgundy: [30.0, 42.0, 18.0],
  Green: [52.0, -45.0, 30.0],
  Brown: [38.0, 15.0, 22.0],
  Pink: [72.0, 35.0, 5.0],
  Yellow: [85.0, -5.0, 75.0],
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let cR = r / 255
  let cG = g / 255
  let cB = b / 255

  cR = cR > 0.04045 ? Math.pow((cR + 0.055) / 1.055, 2.4) : cR / 12.92
  cG = cG > 0.04045 ? Math.pow((cG + 0.055) / 1.055, 2.4) : cG / 12.92
  cB = cB > 0.04045 ? Math.pow((cB + 0.055) / 1.055, 2.4) : cB / 12.92

  const x = (0.4124564 * cR + 0.3575761 * cG + 0.1804375 * cB) / 0.95047
  const y = (0.2126729 * cR + 0.7151522 * cG + 0.0721750 * cB) / 1.00000
  const z = (0.0193339 * cR + 0.1191920 * cG + 0.9503041 * cB) / 1.08883

  const delta = Math.pow(6.0 / 29.0, 3)
  const factor = 1.0 / (3.0 * Math.pow(6.0 / 29.0, 2))

  const f = (t: number) => (t > delta ? Math.cbrt(t) : t * factor + 4.0 / 29.0)

  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  const lStar = 116.0 * fy - 16.0
  const aStar = 500.0 * (fx - fy)
  const bStar = 200.0 * (fy - fz)
  return [Number(lStar.toFixed(2)), Number(aStar.toFixed(2)), Number(bStar.toFixed(2))]
}

function nearestFashionColor(lab: [number, number, number]): string {
  let bestName = 'Black'
  let bestDe = Infinity
  for (const [name, refLab] of Object.entries(REFERENCE_COLORS_LAB)) {
    const de = Math.sqrt(
      Math.pow(lab[0] - refLab[0], 2) +
      Math.pow(lab[1] - refLab[1], 2) +
      Math.pow(lab[2] - refLab[2], 2)
    )
    if (de < bestDe) {
      bestDe = de
      bestName = name
    }
  }
  return bestName
}

function optionalEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value.toUpperCase())
    ? (value.toUpperCase() as T[number])
    : undefined
}

/**
 * Built-in Node.js pixel inspection in YCbCr space + dominant color & palette extraction.
 */
export async function inspectImageModeration(buffer: Buffer): Promise<ImageModerationResult> {
  const rawRgb = await sharp(buffer)
    .rotate()
    .resize(96, 96, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer()

  const width = 96
  const height = 96
  const totalPixels = width * height
  let totalSkinPixels = 0
  let centerPixels = 0
  let centerSkinPixels = 0

  const colorCounts: Record<string, { count: number; labSum: [number, number, number] }> = {}
  for (const name of Object.keys(REFERENCE_COLORS_LAB)) {
    colorCounts[name] = { count: 0, labSum: [0, 0, 0] }
  }

  // Rows 19..77 (inclusive) and cols 19..77 (inclusive) define the central 60% ROI
  for (let r = 0; r < height; r++) {
    const isCenterRow = r >= 19 && r <= 77
    for (let c = 0; c < width; c++) {
      const isCenterCol = c >= 19 && c <= 77
      const isCenter = isCenterRow && isCenterCol
      if (isCenter) centerPixels++

      const idx = (r * width + c) * 3
      const R = rawRgb[idx]
      const G = rawRgb[idx + 1]
      const B = rawRgb[idx + 2]

      // YCbCr conversion (Chapter 2 / Standard ITU-R BT.601)
      const Y = 0.299 * R + 0.587 * G + 0.114 * B
      const Cb = 128 - 0.1687 * R - 0.3313 * G + 0.5 * B
      const Cr = 128 + 0.5 * R - 0.4187 * G - 0.0813 * B

      const isSkin = Y > 80 && Cb >= 77 && Cb <= 127 && Cr >= 133 && Cr <= 173

      if (isSkin) {
        totalSkinPixels++
        if (isCenter) centerSkinPixels++
      }

      // Collect color information in central ROI
      if (isCenter) {
        const lab = rgbToLab(R, G, B)
        const name = nearestFashionColor(lab)
        colorCounts[name].count++
        colorCounts[name].labSum[0] += lab[0]
        colorCounts[name].labSum[1] += lab[1]
        colorCounts[name].labSum[2] += lab[2]
      }
    }
  }

  const fullSkinRatio = totalSkinPixels / totalPixels
  const centerSkinRatio = centerPixels > 0 ? centerSkinPixels / centerPixels : 0

  const sortedColors = Object.entries(colorCounts)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)

  const dominantColor = sortedColors[0] ? sortedColors[0][0] : 'Black'
  const secondaryColor = sortedColors[1] && sortedColors[1][1].count > (centerPixels * 0.1) ? sortedColors[1][0] : null

  const palette: ColorClusterInfo[] = sortedColors.slice(0, 2).map(([name, data]) => ({
    color_name: name,
    proportion: Number((data.count / Math.max(1, centerPixels)).toFixed(4)),
    lab: [
      Number((data.labSum[0] / data.count).toFixed(2)),
      Number((data.labSum[1] / data.count).toFixed(2)),
      Number((data.labSum[2] / data.count).toFixed(2)),
    ],
  }))

  const isUnsafe = centerSkinRatio > 0.28 || fullSkinRatio > 0.40

  if (isUnsafe) {
    return {
      is_safe_garment: false,
      moderation_reason:
        'Inappropriate or skin-dominant image detected (e.g., hand gesture or body photo). Please upload a clear photo of a clothing item or wearable accessory.',
      fullSkinRatio,
      centerSkinRatio,
      dominantColor,
      secondaryColor,
      palette,
    }
  }

  return {
    is_safe_garment: true,
    moderation_reason: null,
    fullSkinRatio,
    centerSkinRatio,
    dominantColor,
    secondaryColor,
    palette,
  }
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
  inspectModeration: inspectImageModeration,

  async analyze(file: Express.Multer.File): Promise<ClothingPrediction> {
    // 1. Run direct Node.js Sharp pixel moderation and color extraction
    const moderation = await inspectImageModeration(file.buffer)
    if (!moderation.is_safe_garment) {
      return {
        category: undefined,
        categoryConfidence: undefined,
        color: moderation.dominantColor,
        secondary_color: moderation.secondaryColor,
        palette: moderation.palette,
        style: undefined,
        confidence: 0,
        is_safe_garment: false,
        moderation_reason: moderation.moderation_reason,
        attributes: null,
      }
    }

    // 2. Query remote CNN microservice if configured
    const analysisUrl = ENV.CNN_ANALYSIS_URL
    if (analysisUrl) {
      try {
        const normalized = await preprocessForCnn(file.buffer)
        const { data } = await axios.post<unknown>(analysisUrl, normalized, {
          headers: { 'Content-Type': 'image/jpeg', 'X-Source-Filename': encodeURIComponent(file.originalname) },
          timeout: 10_000,
        })
        const result = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
        const confidence = typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 ? result.confidence : undefined

        return {
          category: optionalEnum(result.category, CATEGORIES),
          categoryConfidence: confidence,
          color: typeof result.color === 'string' && result.color.length <= 50 ? result.color : moderation.dominantColor,
          secondary_color: typeof result.secondary_color === 'string'
            ? result.secondary_color
            : (result.secondary_color === null ? null : moderation.secondaryColor),
          palette: result.palette ? (result.palette as any) : moderation.palette,
          style: optionalEnum(result.style, STYLES),
          confidence,
          is_safe_garment: typeof result.is_safe_garment === 'boolean' ? result.is_safe_garment : true,
          moderation_reason: typeof result.moderation_reason === 'string'
            ? result.moderation_reason
            : (result.moderation_reason === null ? null : undefined),
          attributes: result.attributes && typeof result.attributes === 'object' ? (result.attributes as Record<string, unknown>) : null,
        }
      } catch (cnnErr: any) {
        if (cnnErr.response?.data?.is_safe_garment === false) {
          return {
            category: undefined,
            confidence: 0,
            is_safe_garment: false,
            moderation_reason: cnnErr.response.data.moderation_reason || moderation.moderation_reason,
          }
        }
        // Fall back gracefully to Node.js color extraction if CNN microservice is offline or unreachable
      }
    }

    // 3. Fallback when Python microservice is not reachable on Render
    return {
      category: undefined,
      categoryConfidence: undefined,
      color: moderation.dominantColor,
      secondary_color: moderation.secondaryColor,
      palette: moderation.palette,
      style: 'CASUAL',
      confidence: 0.50,
      is_safe_garment: true,
      moderation_reason: 'Categorization requires manual confirmation (ML service offline).',
      attributes: null,
    }
  },
}
