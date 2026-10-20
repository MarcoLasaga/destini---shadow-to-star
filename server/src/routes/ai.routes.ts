import { Router } from 'express'
import { aiController } from '../controllers/ai.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { uploadSingle } from '../middleware/upload.middleware'

const router = Router()

router.use(requireAuth)
router.post('/analyze', uploadSingle('image'), aiController.analyze)

export default router

