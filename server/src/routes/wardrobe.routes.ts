import { Router } from 'express'
import { wardrobeController } from '../controllers/wardrobe.controller'
import { requireAuth } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { uploadSingle } from '../middleware/upload.middleware'
import { createItemSchema, updateItemSchema } from '../validators/wardrobe.validator'

const router = Router()

// All wardrobe routes require authentication
router.use(requireAuth)

// CRUD
router.get('/', wardrobeController.getAll)
router.get('/:id', wardrobeController.getById)
router.post('/', uploadSingle('image'), validate(createItemSchema), wardrobeController.create)
router.put('/:id', uploadSingle('image'), validate(updateItemSchema), wardrobeController.update)
router.patch('/:id', uploadSingle('image'), validate(updateItemSchema), wardrobeController.update)
router.delete('/:id', wardrobeController.delete)

// Actions
router.patch('/:id/favorite', wardrobeController.toggleFavorite)
router.patch('/:id/mark-clean', wardrobeController.markClean)
router.patch('/:id/wear', wardrobeController.recordWear)

export default router
