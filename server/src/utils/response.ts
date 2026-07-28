import { Response } from 'express'

export function sendSuccess(res: Response, data: any, message?: string, status: number = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  })
}

export function sendError(res: Response, message: string, status: number = 500, error?: any) {
  return res.status(status).json({
    success: false,
    message,
    error: error || undefined,
  })
}
