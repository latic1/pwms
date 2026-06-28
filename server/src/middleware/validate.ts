import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const message = result.error.issues.map((i) => i.message).join('; ')
      res.status(400).json({ error: message })
      return
    }
    req.body = result.data
    next()
  }
}
