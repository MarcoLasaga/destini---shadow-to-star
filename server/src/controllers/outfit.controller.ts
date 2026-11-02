import type { NextFunction, Response } from 'express'
import { outfitService } from '../services/outfit.service'
import type { AuthRequest } from '../types'
import { sendError, sendSuccess } from '../utils/response'

export const outfitController = {
  async getSaved(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const saved = await outfitService.getSaved(req.user!.userId, req.user!.token)
      sendSuccess(res, saved)
    } catch (error) {
      next(error)
    }
  },

  async saveOutfit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id, item_ids, items, occasion, score, reasons, isSaved, is_saved, isFavorite, is_favorite } = req.body || {}
      const saved = await outfitService.saveOutfit(
        req.user!.userId,
        {
          id,
          item_ids,
          items,
          occasion,
          score,
          reasons,
          isSaved: isSaved ?? is_saved ?? isFavorite ?? is_favorite ?? true,
        },
        req.user!.token
      )
      sendSuccess(res, saved, 'Outfit saved successfully', 201)
    } catch (error) {
      next(error)
    }
  },

  async deleteOutfit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await outfitService.deleteOutfit(req.params.id as string, req.user!.userId, req.user!.token)
      sendSuccess(res, result)
    } catch (error) {
      next(error)
    }
  },

  async generate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(
        res,
        await outfitService.generate(
          req.user!.userId,
          typeof req.query.occasion === 'string' ? req.query.occasion.toUpperCase() : undefined,
          req.user!.token
        )
      )
    } catch (error) {
      next(error)
    }
  },

  async history(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      sendSuccess(res, await outfitService.history(req.user!.userId, req.user!.token))
    } catch (error) {
      next(error)
    }
  },

  async feedback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { isSaved, is_saved, isWorn, rating, note, eventType, item_ids, items, occasion } = req.body || {}
      if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
        sendError(res, 'Rating must be an integer from 1 to 5.', 422)
        return
      }
      sendSuccess(
        res,
        await outfitService.updateFeedback(
          req.params.id as string,
          req.user!.userId,
          {
            isSaved: isSaved ?? is_saved,
            isWorn,
            rating,
            note,
            eventType,
            item_ids,
            items,
            occasion,
          },
          req.user!.token
        )
      )
    } catch (error) {
      next(error)
    }
  },
}
