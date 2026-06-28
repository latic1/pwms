import jwt from 'jsonwebtoken'

const ACCESS_SECRET  = process.env.JWT_SECRET        ?? 'dev_access_secret'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret'
const ACCESS_TTL     = process.env.JWT_EXPIRES_IN     ?? '15m'
const REFRESH_TTL    = '7d'

export type UserRole = 'student' | 'supervisor' | 'admin' | 'examiner'

export interface JwtPayload {
  sub: string      // user id
  email: string
  role: UserRole
  iat?: number
  exp?: number
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL } as jwt.SignOptions)
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload
}
