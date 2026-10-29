import { Response, NextFunction } from 'express'
import axios from 'axios'
import { wardrobeService } from '../services/wardrobe.service'
import { sendSuccess, sendError } from '../utils/response'
import { filterSchema } from '../validators/wardrobe.validator'
import { imageAnalysisService } from '../services/image-analysis.service'
import { getSupabaseClient } from '../config/supabase'
import type { AuthRequest } from '../types'

const VALID_CATEGORIES = new Set(['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'])
const VALID_STYLES = new Set(['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST', 'BOHEMIAN', 'VINTAGE', 'CLASSIC'])
const VALID_LAUNDRY = new Set(['CLEAN', 'DIRTY', 'LAUNDRY', 'NEEDS_WASHING'])

function normalizeCategory(raw?: string | null): 'TOP' | 'BOTTOM' | 'SHOES' | 'OUTERWEAR' | 'ACCESSORIES' {
  const upper = (raw || '').toUpperCase().trim()
  if (VALID_CATEGORIES.has(upper)) return upper as any
  if (upper.includes('SHOE') || upper.includes('BOOT') || upper.includes('SNEAKER') || upper.includes('FOOTWEAR') || upper.includes('SANDAL')) return 'SHOES'
  if (upper.includes('BOTTOM') || upper.includes('PANT') || upper.includes('JEAN') || upper.includes('SHORT') || upper.includes('SKIRT')) return 'BOTTOM'
  if (upper.includes('COAT') || upper.includes('JACKET') || upper.includes('OUTER') || upper.includes('HOODIE') || upper.includes('CARDIGAN')) return 'OUTERWEAR'
  if (upper.includes('ACCESSOR') || upper.includes('BAG') || upper.includes('HAT') || upper.includes('BELT') || upper.includes('WATCH')) return 'ACCESSORIES'
  return 'TOP'
}

function normalizeStyle(raw?: string | null): 'CASUAL' | 'FORMAL' | 'SPORTY' | 'STREETWEAR' | 'MINIMALIST' | 'BOHEMIAN' | 'VINTAGE' | 'CLASSIC' {
  const upper = (raw || '').toUpperCase().trim()
  if (VALID_STYLES.has(upper)) return upper as any
  return 'CASUAL'
}

function normalizeLaundryStatus(raw?: string | null): 'CLEAN' | 'DIRTY' | 'LAUNDRY' | 'NEEDS_WASHING' {
  const upper = (raw || '').toUpperCase().trim()
  if (VALID_LAUNDRY.has(upper)) return upper as any
  if (upper.includes('WASH')) return 'NEEDS_WASHING'
  if (upper.includes('DIRT')) return 'DIRTY'
  return 'CLEAN'
}

const PROFANITY_REGEX = /\b(fuck|shit|bitch|nigger|nigga|faggot|cunt|whore|slut|retard|nsfw|nude|porn)\b/i

function containsProfanity(...fields: (unknown | undefined)[]): boolean {
  for (const field of fields) {
    if (typeof field === 'string' && PROFANITY_REGEX.test(field)) {
      return true
    }
  }
  return false
}

export const wardrobeController = {
  async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = filterSchema.safeParse(req.query)
      if (!parsed.success) {
        sendError(res, 'Invalid filters', 422)
        return
      }
      const result = await wardrobeService.getAll(req.user!.userId, parsed.data, req.user!.token)
      sendSuccess(res, result)
    } catch (err) {
      next(err)
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await wardrobeService.getById(req.params.id as string, req.user!.userId, req.user!.token)
      sendSuccess(res, item)
    } catch (err) {
      next(err)
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clothingName, clothing_name, brand, notes } = req.body || {}
      if (containsProfanity(clothingName, clothing_name, brand, notes)) {
        sendError(res, 'Item name or notes contain prohibited language.', 422)
        return
      }
      if (req.file) {
        const moderation = await imageAnalysisService.inspectModeration(req.file.buffer)
        if (!moderation.is_safe_garment) {
          sendError(
            res,
            moderation.moderation_reason ||
              'Inappropriate or skin-dominant image detected (e.g., hand gesture or body photo). Please upload a clear photo of a clothing item or wearable accessory.',
            422,
            moderation
          )
          return
        }
      }
      const item = await wardrobeService.create(req.user!.userId, req.body, req.file, req.user!.token)
      sendSuccess(res, item, 'Clothing added successfully', 201)
    } catch (err) {
      next(err)
    }
  },

  async analyzeImage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        sendError(res, 'An image is required for analysis.', 422)
        return
      }
      const prediction = await imageAnalysisService.analyze(req.file)
      if (prediction.is_safe_garment === false) {
        sendError(
          res,
          prediction.moderation_reason ||
            'Inappropriate or skin-dominant image detected (e.g., hand gesture or body photo). Please upload a clear photo of a clothing item or wearable accessory.',
          422,
          prediction
        )
        return
      }
      sendSuccess(res, prediction, 'Image analyzed successfully')
    } catch (err) {
      next(err)
    }
  },

  async analyzeBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { images } = req.body || {}
      if (!Array.isArray(images) || images.length === 0) {
        sendError(res, 'An array of images (up to 15) is required.', 422)
        return
      }
      if (images.length > 15) {
        sendError(res, 'Batch size cannot exceed 15 images.', 422)
        return
      }
      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const { data } = await axios.post(
        `${mlUrl}/analyze-batch`,
        { images },
        {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 30_000,
        }
      )
      const results = (data && Array.isArray((data as any).results)) ? (data as any).results : data
      sendSuccess(res, results, 'Batch analysis completed')
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async moderate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const {
        caption = '',
        garment_confidence = 1.0,
        skin_exposure_ratio = 0.0,
      } = req.body || {}

      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const { data } = await axios.post(`${mlUrl}/moderate`, {
        caption: typeof caption === 'string' ? caption : '',
        garment_confidence: typeof garment_confidence === 'number' ? garment_confidence : 1.0,
        skin_exposure_ratio: typeof skin_exposure_ratio === 'number' ? skin_exposure_ratio : 0.0,
      }, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: 10_000,
      })

      const moderationResult = {
        approved: Boolean(data.approved),
        sanitized_caption: String(data.sanitized_caption ?? ''),
        reason: data.reason ?? null,
      }

      return res.status(200).json({
        success: true,
        data: moderationResult,
        ...moderationResult,
      })
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async recommend(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      let weather = {
        temperature_c: 28.0,
        condition: 'Clear',
        humidity: 70.0,
        precipitation_mm: 0.0,
      }

      const apiKey = process.env.OPENWEATHER_API_KEY
      if (apiKey) {
        try {
          const city = req.body?.city || req.query?.city || 'Makati,PH'
          const weatherRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { q: city, units: 'metric', appid: apiKey },
            timeout: 5000,
          })
          if (weatherRes.data) {
            weather = {
              temperature_c: typeof weatherRes.data.main?.temp === 'number' ? weatherRes.data.main.temp : 28.0,
              condition: weatherRes.data.weather?.[0]?.main || 'Clear',
              humidity: typeof weatherRes.data.main?.humidity === 'number' ? weatherRes.data.main.humidity : 70.0,
              precipitation_mm: typeof weatherRes.data.rain?.['1h'] === 'number'
                ? weatherRes.data.rain['1h']
                : (typeof weatherRes.data.rain?.['3h'] === 'number' ? weatherRes.data.rain['3h'] : 0.0),
            }
          }
        } catch (_weatherErr) {
          // Gracefully fallback to Makati/Manila 28C Clear if offline/unset or error
          weather = {
            temperature_c: 28.0,
            condition: 'Clear',
            humidity: 70.0,
            precipitation_mm: 0.0,
          }
        }
      }

      if (req.body?.weather && typeof req.body.weather === 'object') {
        weather = { ...weather, ...req.body.weather }
      }

      let rawItems: any[] = []
      if (Array.isArray(req.body?.wardrobe) && req.body.wardrobe.length > 0) {
        rawItems = req.body.wardrobe
      } else {
        try {
          const supabase = await getSupabaseClient(req.user!.token)
          const { data, error } = await supabase
            .from('wardrobe_items')
            .select('*')
            .eq('user_id', req.user!.userId)

          if (error) throw error
          rawItems = data || []
        } catch (dbErr: any) {
          if (dbErr.message?.includes('supabaseKey is required')) {
            rawItems = []
          } else {
            throw dbErr
          }
        }
      }

      const mappedWardrobe = (rawItems || []).map((row: any) => {
        return {
          id: String(row.id),
          clothing_name: row.clothing_name || row.clothingName || 'Item',
          category: normalizeCategory(row.category),
          color: (typeof row.color === 'string' && row.color.trim()) ? row.color.trim() : 'Black',
          primary_color: row.primary_color || row.primaryColor || null,
          secondary_color: row.secondary_color || row.secondaryColor || null,
          style: normalizeStyle(row.style),
          occasion: row.occasion || 'Casual',
          vector_subtype: row.vector_subtype || row.vectorSubtype || null,
          texture: row.texture || null,
          fit: row.fit || null,
          target_gender: row.target_gender || row.targetGender || 'unisex',
          image_url: row.image_url || row.imageUrl || null,
          laundry_status: normalizeLaundryStatus(row.laundry_status || row.laundryStatus),
          is_favorite: Boolean(row.is_favorite ?? row.isFavorite ?? false),
          is_disliked: Boolean(row.is_disliked ?? row.isDisliked ?? false),
        }
      })

      let preferredStyles = ['CASUAL']
      let preferredColors = ['Black', 'White', 'Navy']

      if (Array.isArray(req.body?.preferred_styles) && req.body.preferred_styles.length > 0) {
        preferredStyles = req.body.preferred_styles
          .map((s: string) => String(s).toUpperCase())
          .filter((s: string) => VALID_STYLES.has(s))
        if (!preferredStyles.length) preferredStyles = ['CASUAL']
      }
      if (Array.isArray(req.body?.preferred_colors) && req.body.preferred_colors.length > 0) {
        preferredColors = req.body.preferred_colors.filter((c: unknown) => typeof c === 'string' && (c as string).length > 0)
        if (!preferredColors.length) preferredColors = ['Black', 'White', 'Navy']
      }

      const mlPayload = {
        user_id: req.user!.userId,
        target_occasion: req.body?.target_occasion || req.body?.occasion || 'Casual',
        no_new_clothes_mode: req.body?.no_new_clothes_mode ?? true,
        wardrobe: mappedWardrobe,
        preferred_styles: preferredStyles,
        preferred_colors: preferredColors,
        weather,
        community_signals: Array.isArray(req.body?.community_signals) ? req.body.community_signals : [],
        alpha: typeof req.body?.alpha === 'number' ? req.body.alpha : 0.55,
        gender: req.body?.gender || 'unisex',
        source_mode: req.body?.source_mode || 'wardrobe',
        textures: Array.isArray(req.body?.textures) ? req.body.textures : [],
        favorite_colors: Array.isArray(req.body?.favorite_colors) ? req.body.favorite_colors : [],
        fit_preference: req.body?.fit_preference || null,
        common_occasions: Array.isArray(req.body?.common_occasions) ? req.body.common_occasions : [],
      }

      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const { data: recommendations } = await axios.post(`${mlUrl}/recommend`, mlPayload, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: 15_000,
      })

      if (req.query?.raw === 'true') {
        return res.status(200).json(recommendations)
      }

      return res.status(200).json({
        success: true,
        data: recommendations,
        recommendations,
      })
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async scoreOutfit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const { data: scoreResult } = await axios.post(`${mlUrl}/score-outfit`, req.body, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
        timeout: 15_000,
      })
      return res.status(200).json({
        success: true,
        data: scoreResult,
        ...scoreResult,
      })
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async beautify(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { image_base64, category, sub_category, color, color_hex, hf_token } = req.body || {}
      if (typeof image_base64 !== 'string' || !image_base64.trim()) {
        sendError(res, 'image_base64 is required.', 422)
        return
      }
      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const headerToken = req.header('x-hf-token')
      const { data } = await axios.post(
        `${mlUrl}/beautify`,
        { image_base64, category, sub_category, color, color_hex, hf_token: hf_token || undefined },
        {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            ...(headerToken ? { 'x-hf-token': headerToken } : {}),
          },
          timeout: 65_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      )
      return res.status(200).json({ success: true, data, ...data })
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async tryOn2D(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { user_photo_base64, items, skin_tone_hex, hf_token } = req.body || {}
      if (typeof user_photo_base64 !== 'string' || !user_photo_base64.trim()) {
        sendError(res, 'user_photo_base64 is required.', 422)
        return
      }
      if (!Array.isArray(items) || items.length === 0) {
        sendError(res, 'At least one outfit item is required for try-on.', 422)
        return
      }
      const mlUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
      const headerToken = req.header('x-hf-token')
      // 65 s timeout so yisol/IDM-VTON has time for its 15–25 s diffusion pass on Hugging Face ZeroGPU
      // (ml-service falls back to its local Cladwell Studio compositor after ~50 s).
      const { data } = await axios.post(
        `${mlUrl}/try-on-2d`,
        { user_photo_base64, items, skin_tone_hex: skin_tone_hex || null, hf_token: hf_token || undefined },
        {
          headers: {
            'ngrok-skip-browser-warning': 'true',
            ...(headerToken ? { 'x-hf-token': headerToken } : {}),
          },
          timeout: 65_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      )
      return res.status(200).json({ success: true, data, ...data })
    } catch (err: any) {
      if (err.response?.status) {
        sendError(res, err.response.data?.detail || err.message, err.response.status)
        return
      }
      next(err)
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { clothingName, clothing_name, brand, notes } = req.body || {}
      if (containsProfanity(clothingName, clothing_name, brand, notes)) {
        sendError(res, 'Item name or notes contain prohibited language.', 422)
        return
      }
      if (req.file) {
        const moderation = await imageAnalysisService.inspectModeration(req.file.buffer)
        if (!moderation.is_safe_garment) {
          sendError(
            res,
            moderation.moderation_reason ||
              'Inappropriate or skin-dominant image detected (e.g., hand gesture or body photo). Please upload a clear photo of a clothing item or wearable accessory.',
            422,
            moderation
          )
          return
        }
      }
      const item = await wardrobeService.update(req.params.id as string, req.user!.userId, req.body, req.file, req.user!.token)
      sendSuccess(res, item, 'Clothing updated successfully')
    } catch (err) {
      next(err)
    }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await wardrobeService.delete(req.params.id as string, req.user!.userId, req.user!.token)
      sendSuccess(res, null, 'Clothing removed successfully')
    } catch (err) {
      next(err)
    }
  },

  async toggleFavorite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await wardrobeService.toggleFavorite(req.params.id as string, req.user!.userId, req.user!.token)
      const msg = item.isFavorite ? 'Added to Favorites' : 'Removed from Favorites'
      sendSuccess(res, item, msg)
    } catch (err) {
      next(err)
    }
  },

  async markClean(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await wardrobeService.markClean(req.params.id as string, req.user!.userId, req.user!.token)
      sendSuccess(res, item, 'Marked as Clean')
    } catch (err) {
      next(err)
    }
  },

  async recordWear(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await wardrobeService.recordWear(req.params.id as string, req.user!.userId, req.user!.token)
      sendSuccess(res, item, 'Wear recorded')
    } catch (err) {
      next(err)
    }
  },
}
