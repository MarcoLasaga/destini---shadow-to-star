import { z } from 'zod'

const CATEGORIES = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'] as const
const STYLES = ['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'] as const
const OCCASIONS = ['SCHOOL', 'WORK', 'GYM', 'PARTY', 'DATE', 'OUTDOOR', 'EVERYDAY'] as const
const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER', 'ALL_SEASONS'] as const
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export const createItemSchema = z.object({
  category: z.enum(CATEGORIES),
  clothingName: z.string().min(1, 'Name is required').max(255),
  subcategory: z.string().max(100).optional(),
  color: z.string().max(50).optional(),
  material: z.string().max(100).optional(),
  brand: z.string().max(100).optional(),
  style: z.enum(STYLES).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  season: z.enum(SEASONS).optional(),
  size: z.enum(SIZES).optional(),
  estimatedPrice: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
})

export const updateItemSchema = createItemSchema.partial()

export const filterSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  style: z.enum(STYLES).optional(),
  occasion: z.enum(OCCASIONS).optional(),
  season: z.enum(SEASONS).optional(),
  laundryStatus: z.enum(['CLEAN', 'NEEDS_WASHING_SOON', 'NEEDS_WASHING']).optional(),
  isFavorite: z.coerce.boolean().optional(),
  search: z.string().max(255).optional(),
  sortBy: z.enum(['createdAt', 'clothingName', 'wearCount', 'category']).optional().default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type FilterInput = z.infer<typeof filterSchema>
