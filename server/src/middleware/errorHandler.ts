import { Request, Response, NextFunction } from 'express'
import { sendError } from '../utils/response'

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error handler caught error:', err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  return sendError(res, message, status, err.errors || undefined)
}
