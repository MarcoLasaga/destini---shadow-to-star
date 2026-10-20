import { Response, NextFunction } from 'express'
import axios from 'axios'
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
      const mlUrl = process.env.ML_SERVICE_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8000')
      if (!mlUrl) {
        sendError(res, 'ML microservice is not configured. Set ML_SERVICE_URL to the deployed microservice.', 503)
        return
      }
      const { data } = await axios.post(`${mlUrl}/analyze-batch`, { images }, { timeout: 60_000 })
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
}

