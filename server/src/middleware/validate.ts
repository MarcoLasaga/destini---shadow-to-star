import { Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { sendError } from '../utils/response'
import type { AuthRequest } from '../types'

export const validate = (schema: ZodSchema) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.safeParseAsync(req.body)
      if (!parsed.success) {
        return sendError(res, 'Validation error', 400, parsed.error.format())
      }
      req.body = parsed.data
      next()
    } catch (error) {
      next(error)
    }
  }
}
