import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload, UserRole } from '../lib/jwt'

// Extend Express Request so downstream handlers have req.user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

/**
 * Verifies the Bearer token and attaches req.user.
 * Returns 401 if missing or invalid.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Role guard — call after authenticate().
 * Usage: requireRole('admin')  or  requireRole('supervisor', 'admin')
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      })
      return
    }

    next()
  }
}
