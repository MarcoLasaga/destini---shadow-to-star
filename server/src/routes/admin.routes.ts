import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requireAdmin } from '../middleware/admin.middleware'
import { adminController } from '../controllers/admin.controller'

const router = Router()
router.use(requireAuth, requireAdmin)
router.get('/dataset', adminController.datasetOverview)
router.get('/dataset/manifest', adminController.datasetManifest)
router.patch('/dataset/:id', adminController.reviewDatasetItem)
export default router
