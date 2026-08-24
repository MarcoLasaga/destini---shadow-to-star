import type { NextFunction, Response } from 'express'
import { outfitService } from '../services/outfit.service'
import type { AuthRequest } from '../types'
import { sendError, sendSuccess } from '../utils/response'

export const outfitController = {
  async generate(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await outfitService.generate(req.user!.userId, typeof req.query.occasion === 'string' ? req.query.occasion.toUpperCase() : undefined, req.user!.token)) } catch (error) { next(error) }
  },
  async feedback(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { isSaved, isWorn, rating, note } = req.body
      if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) { sendError(res, 'Rating must be an integer from 1 to 5.', 422); return }
      sendSuccess(res, await outfitService.updateFeedback(req.params.id as string, req.user!.userId, { isSaved, isWorn, rating, note }, req.user!.token))
    } catch (error) { next(error) }
  },
}
