import { Response, NextFunction } from 'express'
import { imageAnalysisService, type AnalysisResult } from '../services/image-analysis.service'
import { sendSuccess, sendError } from '../utils/response'
import type { AuthRequest } from '../types'

export const aiController = {
  async analyze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        sendError(res, 'An image is required for analysis.', 422)
        return
      }
      const analysisResult: AnalysisResult = await imageAnalysisService.analyze(req.file)
      if (analysisResult.is_safe_garment === false) {
        sendError(
          res,
          analysisResult.moderation_reason ||
            'Inappropriate or skin-dominant image detected (e.g., hand gesture or body photo). Please upload a clear photo of a clothing item or wearable accessory.',
          422,
          analysisResult
        )
        return
      }
      sendSuccess(res, analysisResult, 'Image analyzed successfully')
    } catch (err) {
      next(err)
    }
  },
}

