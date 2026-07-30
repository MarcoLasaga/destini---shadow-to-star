import { Response, NextFunction } from 'express'
import { wardrobeService } from '../services/wardrobe.service'
import { sendSuccess, sendError } from '../utils/response'
import { filterSchema } from '../validators/wardrobe.validator'
import { imageAnalysisService } from '../services/image-analysis.service'
import type { AuthRequest } from '../types'

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
      sendSuccess(res, prediction, 'Image analyzed successfully')
    } catch (err) {
      next(err)
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
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
