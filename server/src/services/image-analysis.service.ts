import axios from 'axios'
import sharp from 'sharp'
import { ENV } from '../config/env'

const CATEGORIES = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
const STYLES = ['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'] as const
const LAYER_ROLES = ['INNER_BASE', 'OUTER_LAYER', 'LOWER_BODY', 'FOOTWEAR', 'ACCESSORY'] as const
const MATERIALS = ['Cotton', 'Denim', 'Polyester', 'Wool', 'Silk', 'Linen', 'Leather', 'Knit', 'Nylon', 'Other'] as const
const OCCASIONS = ['SCHOOL', 'WORK', 'GYM', 'PARTY', 'DATE', 'OUTDOOR', 'EVERYDAY'] as const

export type CategoryType = (typeof CATEGORIES)[number]
export type StyleType = (typeof STYLES)[number]
export type LayerRoleType = (typeof LAYER_ROLES)[number]
export type MaterialType = (typeof MATERIALS)[number]
export type OccasionType = (typeof OCCASIONS)[number]

export interface ColorClusterInfo {
  color_name: string
  proportion: number
  lab: [number, number, number] | number[]
}

export interface ClothingPrediction {
  category?: CategoryType
  categoryConfidence?: number
  subCategory?: string | null
  suggestedName?: string | null
  layerRole?: LayerRoleType | null
  color?: string
  colorHex?: string | null
  secondary_color?: string | null
  palette?: ColorClusterInfo[] | Record<string, unknown> | unknown
  style?: StyleType
  occasion?: OccasionType | string | null
  material?: MaterialType | string | null
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
  colorHex: string
  secondaryColor: string | null
  palette: ColorClusterInfo[]
}

const REFERENCE_COLORS_LAB: Record<string, [number, number, number]> = {
  Black: [18.0, 0.0, 0.0],
  White: [92.0, 0.0, 0.0],
  Gray: [58.0, 0.0, 0.0],
  Navy: [25.0, 8.0, -32.0],
  Blue: [45.0, 5.0, -48.0],
  Red: [48.0, 62.0, 35.0],
  Burgundy: [30.0, 42.0, 18.0],
  Green: [52.0, -45.0, 30.0],
  Olive: [48.0, -14.0, 28.0],
  Brown: [38.0, 15.0, 22.0],
  Beige: [82.0, 2.0, 14.0],
  Khaki: [68.0, 1.0, 20.0],
  Cream: [91.0, 1.0, 10.0],
  Pink: [72.0, 35.0, 5.0],
  Orange: [64.0, 42.0, 58.0],
}

interface GarmentNounEntry {
  subCategory: string
  material: MaterialType
  style: StyleType
  occasion: OccasionType
  layerRole: LayerRoleType
  category: CategoryType
}

const GARMENT_NOUN_MAP: Record<string, GarmentNounEntry> = {
  sweatshirt: { subCategory: 'Pullover Hoodie', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  hoodie: { subCategory: 'Pullover Hoodie', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  cardigan: { subCategory: 'Knit Cardigan', material: 'Knit', style: 'CLASSIC', occasion: 'WORK', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  suit: { subCategory: 'Structured Blazer', material: 'Wool', style: 'FORMAL', occasion: 'WORK', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  blazer: { subCategory: 'Structured Blazer', material: 'Wool', style: 'FORMAL', occasion: 'WORK', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  trench: { subCategory: 'Tailored Coat', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  coat: { subCategory: 'Tailored Coat', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  windbreaker: { subCategory: 'Everyday Jacket', material: 'Nylon', style: 'STREETWEAR', occasion: 'EVERYDAY', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  jacket: { subCategory: 'Everyday Jacket', material: 'Nylon', style: 'STREETWEAR', occasion: 'EVERYDAY', layerRole: 'OUTER_LAYER', category: 'OUTERWEAR' },
  jersey: { subCategory: 'Crewneck T-Shirt', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'INNER_BASE', category: 'TOP' },
  't-shirt': { subCategory: 'Crewneck T-Shirt', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'INNER_BASE', category: 'TOP' },
  tee: { subCategory: 'Crewneck T-Shirt', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'INNER_BASE', category: 'TOP' },
  polo: { subCategory: 'Polo Shirt', material: 'Cotton', style: 'CLASSIC', occasion: 'EVERYDAY', layerRole: 'INNER_BASE', category: 'TOP' },
  oxford: { subCategory: 'Button-Down Shirt', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'INNER_BASE', category: 'TOP' },
  blouse: { subCategory: 'Button-Down Shirt', material: 'Silk', style: 'CLASSIC', occasion: 'WORK', layerRole: 'INNER_BASE', category: 'TOP' },
  shirt: { subCategory: 'Button-Down Shirt', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'INNER_BASE', category: 'TOP' },
  jeans: { subCategory: 'Denim Jeans', material: 'Denim', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  jean: { subCategory: 'Denim Jeans', material: 'Denim', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  denim: { subCategory: 'Denim Jeans', material: 'Denim', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  chinos: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  chino: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  trousers: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  trouser: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CLASSIC', occasion: 'WORK', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  miniskirt: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  kilt: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  sarong: { subCategory: 'Tailored Bottoms', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY', category: 'BOTTOM' },
  loafer: { subCategory: 'Leather Loafers', material: 'Leather', style: 'FORMAL', occasion: 'WORK', layerRole: 'FOOTWEAR', category: 'SHOES' },
  'running shoe': { subCategory: 'Everyday Sneakers', material: 'Leather', style: 'SPORTY', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  sneakers: { subCategory: 'Everyday Sneakers', material: 'Leather', style: 'SPORTY', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  sneaker: { subCategory: 'Everyday Sneakers', material: 'Leather', style: 'SPORTY', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  slippers: { subCategory: 'Comfort Sandals', material: 'Leather', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  slipper: { subCategory: 'Comfort Sandals', material: 'Leather', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  sandal: { subCategory: 'Comfort Sandals', material: 'Leather', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR', category: 'SHOES' },
  boot: { subCategory: 'Ankle Boots', material: 'Leather', style: 'CLASSIC', occasion: 'OUTDOOR', layerRole: 'FOOTWEAR', category: 'SHOES' },
  watch: { subCategory: 'Minimalist Wristwatch', material: 'Other', style: 'CLASSIC', occasion: 'WORK', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  backpack: { subCategory: 'Everyday Carry Bag', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  handbag: { subCategory: 'Everyday Carry Bag', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  purse: { subCategory: 'Everyday Carry Bag', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  tote: { subCategory: 'Everyday Carry Bag', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  tie: { subCategory: 'Tailored Necktie', material: 'Silk', style: 'FORMAL', occasion: 'WORK', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
  belt: { subCategory: 'Classic Waist Belt', material: 'Leather', style: 'CLASSIC', occasion: 'WORK', layerRole: 'ACCESSORY', category: 'ACCESSORIES' },
}

const CATEGORY_DEFAULTS: Record<CategoryType, Omit<GarmentNounEntry, 'category'>> = {
  TOP: { subCategory: 'Crewneck T-Shirt', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'INNER_BASE' },
  OUTERWEAR: { subCategory: 'Pullover Hoodie', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'OUTER_LAYER' },
  BOTTOM: { subCategory: 'Denim Jeans', material: 'Denim', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'LOWER_BODY' },
  SHOES: { subCategory: 'Everyday Sneakers', material: 'Leather', style: 'SPORTY', occasion: 'EVERYDAY', layerRole: 'FOOTWEAR' },
  ACCESSORIES: { subCategory: 'Everyday Carry Bag', material: 'Cotton', style: 'CASUAL', occasion: 'EVERYDAY', layerRole: 'ACCESSORY' },
}

function inferFromFilename(filename?: string, fallbackCategory?: CategoryType): GarmentNounEntry | null {
  if (filename) {
    const cleaned = decodeURIComponent(filename)
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9]+/g, ' ')
    for (const [kw, entry] of Object.entries(GARMENT_NOUN_MAP)) {
      const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}s?\\b`, 'i')
      if (regex.test(cleaned)) {
        return entry
      }
    }
  }
  if (fallbackCategory && CATEGORY_DEFAULTS[fallbackCategory]) {
    return { category: fallbackCategory, ...CATEGORY_DEFAULTS[fallbackCategory] }
  }
  return null
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
  const [lVal, aVal, bVal] = lab
  const chroma = Math.sqrt(aVal * aVal + bVal * bVal)
  if (lVal >= 82.0 && chroma < 8.0) return 'White'
  if (lVal >= 78.0 && chroma >= 8.0 && chroma < 16.0 && bVal > 6.0) return 'Cream'
  if (lVal <= 26.0 && chroma < 12.0) return 'Black'
  if (lVal > 26.0 && lVal < 82.0 && chroma < 9.5) return 'Gray'

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

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Built-in Node.js pixel inspection in YCbCr space + dominant color, hex & palette extraction.
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

  const colorCounts: Record<string, { count: number; labSum: [number, number, number]; rVals: number[]; gVals: number[]; bVals: number[] }> = {}
  for (const name of Object.keys(REFERENCE_COLORS_LAB)) {
    colorCounts[name] = { count: 0, labSum: [0, 0, 0], rVals: [], gVals: [], bVals: [] }
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
        colorCounts[name].rVals.push(R)
        colorCounts[name].gVals.push(G)
        colorCounts[name].bVals.push(B)
      }
    }
  }

  const fullSkinRatio = totalSkinPixels / totalPixels
  const centerSkinRatio = centerPixels > 0 ? centerSkinPixels / centerPixels : 0

  const sortedColors = Object.entries(colorCounts)
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)

  const dominantEntry = sortedColors[0]
  const dominantColor = dominantEntry ? dominantEntry[0] : 'Black'
  const colorHex = dominantEntry
    ? rgbToHex(
        median(dominantEntry[1].rVals),
        median(dominantEntry[1].gVals),
        median(dominantEntry[1].bVals)
      )
    : '#1a1a1a'
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
      colorHex,
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
    colorHex,
    secondaryColor,
    palette,
  }
}

/**
 * Keeps model input consistent across phone and web uploads: EXIF is applied,
 * dimensions are constrained and RGB JPEG pixels are produced.
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
        subCategory: null,
        suggestedName: null,
        layerRole: null,
        color: moderation.dominantColor,
        colorHex: moderation.colorHex,
        secondary_color: moderation.secondaryColor,
        palette: moderation.palette,
        style: undefined,
        occasion: null,
        material: null,
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
        const resolvedCat = optionalEnum(result.category, CATEGORIES)
        const resolvedColor = typeof result.color === 'string' && result.color.length <= 50 ? result.color : moderation.dominantColor
        const inferred = inferFromFilename(file.originalname, resolvedCat)

        const subCategory =
          typeof result.subCategory === 'string' && result.subCategory.trim()
            ? result.subCategory.trim()
            : (inferred?.subCategory ?? null)
        const suggestedName =
          typeof result.suggestedName === 'string' && result.suggestedName.trim()
            ? result.suggestedName.trim()
            : (subCategory ? `${resolvedColor} ${subCategory}` : null)
        const layerRole =
          optionalEnum(result.layerRole, LAYER_ROLES) ?? inferred?.layerRole ?? null
        const colorHex =
          typeof result.colorHex === 'string' && /^#[0-9a-f]{6}$/i.test(result.colorHex)
            ? result.colorHex
            : moderation.colorHex
        const style = optionalEnum(result.style, STYLES) ?? inferred?.style
        const occasion =
          optionalEnum(result.occasion, OCCASIONS) ??
          (typeof result.occasion === 'string' ? result.occasion : (inferred?.occasion ?? null))
        const material =
          typeof result.material === 'string' && result.material.trim()
            ? result.material.trim()
            : (inferred?.material ?? null)

        return {
          category: resolvedCat ?? inferred?.category,
          categoryConfidence: confidence,
          subCategory,
          suggestedName,
          layerRole,
          color: resolvedColor,
          colorHex,
          secondary_color: typeof result.secondary_color === 'string'
            ? result.secondary_color
            : (result.secondary_color === null ? null : moderation.secondaryColor),
          palette: result.palette ? (result.palette as any) : moderation.palette,
          style,
          occasion,
          material,
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
        // Fall back gracefully to Node.js color & filename extraction if CNN microservice is offline
      }
    }

    // 3. Fallback when Python microservice is not reachable on Render
    const fallbackMeta = inferFromFilename(file.originalname, 'TOP')!
    return {
      category: fallbackMeta.category,
      categoryConfidence: 0.50,
      subCategory: fallbackMeta.subCategory,
      suggestedName: `${moderation.dominantColor} ${fallbackMeta.subCategory}`,
      layerRole: fallbackMeta.layerRole,
      color: moderation.dominantColor,
      colorHex: moderation.colorHex,
      secondary_color: moderation.secondaryColor,
      palette: moderation.palette,
      style: fallbackMeta.style,
      occasion: fallbackMeta.occasion,
      material: fallbackMeta.material,
      confidence: 0.50,
      is_safe_garment: true,
      moderation_reason: 'Categorization requires manual confirmation (ML service offline).',
      attributes: null,
    }
  },
}
