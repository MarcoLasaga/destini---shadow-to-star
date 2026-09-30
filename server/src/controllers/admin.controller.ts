import { Response, NextFunction } from 'express'
import { datasetRepository, type DatasetStatus } from '../repositories/dataset.repository'
import { sendSuccess } from '../utils/response'
import type { AuthRequest } from '../types'

export const adminController = {
  async datasetManifest(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await datasetRepository.getApprovedManifest(req.user!.token)) } catch (error) { next(error) }
  },

  async datasetOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try { sendSuccess(res, await datasetRepository.getOverview(req.user!.token)) } catch (error) { next(error) }
  },

  async reviewDatasetItem(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.body?.status as DatasetStatus
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        res.status(422).json({ success: false, message: 'Invalid dataset status' })
        return
      }
      const split = req.body?.split === 'VALIDATION' || req.body?.split === 'TEST' ? req.body.split : 'TRAIN'
      const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 1000) : null
      sendSuccess(res, await datasetRepository.review(req.params.id as string, req.user!.userId, status, split, note, req.user!.token))
    } catch (error) { next(error) }
  },
}
