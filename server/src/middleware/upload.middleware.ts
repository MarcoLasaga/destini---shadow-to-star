import multer from 'multer'
import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response'

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
// Must stay aligned with the Supabase wardrobe-images bucket limit.
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

const storage = multer.memoryStorage() // keep in buffer — uploadService decides where to persist

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}`))
  },
})

export const uploadSingle = (fieldName: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          sendError(res, 'File too large. Maximum size is 5 MB.', 400)
          return
        }
        sendError(res, err.message, 400)
        return
      }
      if (err) {
        sendError(res, err.message, 400)
        return
      }
      next()
    })
  }
