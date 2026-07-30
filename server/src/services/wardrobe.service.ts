import { wardrobeRepository } from '../repositories/wardrobe.repository'
import { uploadService } from '../config/upload'
import type { CreateItemInput, UpdateItemInput, FilterInput } from '../validators/wardrobe.validator'

function notFound() {
  return Object.assign(new Error('Item not found or access denied'), { statusCode: 404, isOperational: true })
}

export const wardrobeService = {
  async getAll(userId: string, filters: FilterInput, token?: string) {
    return wardrobeRepository.findAll(userId, filters, token)
  },

  async getById(id: string, userId: string, token?: string) {
    const item = await wardrobeRepository.findById(id, userId, token)
    if (!item) throw notFound()
    return item
  },

  async create(userId: string, data: CreateItemInput, file?: Express.Multer.File, token?: string) {
    let imageUrl: string | undefined
    if (file) {
      const result = await uploadService.uploadBuffer(file.buffer, file.originalname, file.mimetype, userId, token)
      imageUrl = result.url
    }
    return wardrobeRepository.create(userId, data, imageUrl, token)
  },

  async update(id: string, userId: string, data: UpdateItemInput, file?: Express.Multer.File, token?: string) {
    const existing = await wardrobeRepository.findById(id, userId, token)
    if (!existing) throw notFound()

    let imageUrl: string | undefined
    if (file) {
      // Delete old image
      if (existing.imageUrl) {
        const pathPrefix = '/storage/v1/object/public/wardrobe-images/'
        if (existing.imageUrl.includes(pathPrefix)) {
          const oldPath = existing.imageUrl.split(pathPrefix)[1]
          if (oldPath) await uploadService.deleteFile(oldPath, token).catch(() => null)
        } else if (!existing.imageUrl.includes('cloudinary')) {
          const oldPublicId = existing.imageUrl.split('/uploads/')[1]
          if (oldPublicId) await uploadService.deleteFile(oldPublicId, token).catch(() => null)
        }
      }
      const result = await uploadService.uploadBuffer(file.buffer, file.originalname, file.mimetype, userId, token)
      imageUrl = result.url
    }

    const updated = await wardrobeRepository.update(id, userId, data, imageUrl, token)
    if (!updated) throw notFound()
    return updated
  },

  async delete(id: string, userId: string, token?: string) {
    const item = await wardrobeRepository.findById(id, userId, token)
    if (!item) throw notFound()

    // Delete image from storage
    if (item.imageUrl) {
      const pathPrefix = '/storage/v1/object/public/wardrobe-images/'
      if (item.imageUrl.includes(pathPrefix)) {
        const oldPath = item.imageUrl.split(pathPrefix)[1]
        if (oldPath) await uploadService.deleteFile(oldPath, token).catch(() => null)
      } else if (!item.imageUrl.includes('cloudinary')) {
        const publicId = item.imageUrl.split('/uploads/')[1]
        if (publicId) await uploadService.deleteFile(publicId, token).catch(() => null)
      }
    }

    const deleted = await wardrobeRepository.delete(id, userId, token)
    if (!deleted) throw notFound()
    return deleted
  },

  async toggleFavorite(id: string, userId: string, token?: string) {
    const item = await wardrobeRepository.toggleFavorite(id, userId, token)
    if (!item) throw notFound()
    return item
  },

  async markClean(id: string, userId: string, token?: string) {
    const item = await wardrobeRepository.markClean(id, userId, token)
    if (!item) throw notFound()
    return item
  },

  async recordWear(id: string, userId: string, token?: string) {
    const item = await wardrobeRepository.incrementWear(id, userId, token)
    if (!item) throw notFound()
    return item
  },
}
