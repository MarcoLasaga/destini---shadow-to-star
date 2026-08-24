import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { outfitController } from '../controllers/outfit.controller'

const router = Router()
router.use(requireAuth)
router.get('/generate', outfitController.generate)
router.patch('/:id/feedback', outfitController.feedback)
export default router
