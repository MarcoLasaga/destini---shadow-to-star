import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { outfitController } from '../controllers/outfit.controller'

const router = Router()
router.use(requireAuth)

// Saved Outfits CRUD & Recommendations
router.get('/', outfitController.getSaved)
router.post('/', outfitController.saveOutfit)
router.get('/generate', outfitController.generate)
router.get('/history', outfitController.history)
router.patch('/:id/feedback', outfitController.feedback)
router.patch('/:id', outfitController.feedback)
router.delete('/:id', outfitController.deleteOutfit)

export default router
