import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { query, queryOne } from '../db'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { authenticate } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import {
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../lib/schemas'
import { sendSms } from '../lib/sms'

const router = Router()

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbUser {
  id: string
  name: string
  email: string
  password_hash: string
  role: string
  phone: string | null
  index_number: string | null
  department: string | null
  program: string | null
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const user = await queryOne<DbUser>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  )

  if (!user) {
    // Use constant-time response to prevent email enumeration
    await bcrypt.compare(password, '$2b$10$invalidhashpadding000000000000000000000000000000000000')
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)

  if (!passwordMatch) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const tokenPayload = { sub: user.id, email: user.email, role: user.role as any }
  const accessToken  = signAccessToken(tokenPayload)
  const refreshToken = signRefreshToken(tokenPayload)

  // Return safe user object (no password hash)
  res.json({
    accessToken,
    refreshToken,
    user: {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      indexNumber: user.index_number,
      department:  user.department,
      program:     user.program,
    },
  })
})

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body

  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token is required' })
    return
  }

  try {
    const payload = verifyRefreshToken(refreshToken)

    // Confirm user still exists and role hasn't changed
    const user = await queryOne<DbUser>(
      'SELECT id, email, role FROM users WHERE id = $1',
      [payload.sub]
    )

    if (!user) {
      res.status(401).json({ error: 'User no longer exists' })
      return
    }

    const tokenPayload = { sub: user.id, email: user.email, role: user.role as any }
    const newAccessToken = signAccessToken(tokenPayload)

    res.json({ accessToken: newAccessToken })
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' })
  }
})

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const user = await queryOne<DbUser>(
    `SELECT id, name, email, role, index_number, department, program
     FROM users WHERE id = $1`,
    [req.user!.sub]
  )

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.json({
    id:          user.id,
    name:        user.name,
    email:       user.email,
    role:        user.role,
    indexNumber: user.index_number,
    department:  user.department,
    program:     user.program,
  })
})

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

router.post('/forgot-password', validate(forgotPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body

  const user = await queryOne<DbUser>(
    'SELECT id, name, phone FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  )

  // Always respond with success to prevent email enumeration
  if (!user) {
    res.json({ message: 'If that account exists, a reset code has been sent to your registered phone.' })
    return
  }

  if (!user.phone) {
    // Account exists but has no phone — still return generic message
    res.json({ message: 'If that account exists, a reset code has been sent to your registered phone.' })
    return
  }

  // Invalidate any existing tokens for this user
  await query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
    [user.id]
  )

  // Generate a 6-digit OTP (100000–999999)
  const otp       = String(100000 + (crypto.randomBytes(3).readUIntBE(0, 3) % 900000))
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

  await query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, otp, expiresAt]
  )

  // Send OTP via SMS
  sendSms(
    'Hello {$name}. Your FYP-WMS password reset code is: {$otp}. It expires in 1 hour. If you did not request this, ignore this message.',
    [{ number: user.phone, values: [user.name, otp] }]
  )

  res.json({ message: 'If that account exists, a reset code has been sent to your registered phone.' })
})

// ─── POST /auth/reset-password ────────────────────────────────────────────────

router.post('/reset-password', validate(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body

  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and new password are required' })
    return
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  const resetToken = await queryOne<{ user_id: string; expires_at: string; used: boolean }>(
    `SELECT user_id, expires_at, used
     FROM password_reset_tokens
     WHERE token = $1`,
    [token]
  )

  if (!resetToken || resetToken.used || new Date(resetToken.expires_at) < new Date()) {
    res.status(400).json({ error: 'Invalid or expired reset token' })
    return
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [
    passwordHash,
    resetToken.user_id,
  ])

  await query(
    'UPDATE password_reset_tokens SET used = TRUE WHERE token = $1',
    [token]
  )

  res.json({ message: 'Password updated successfully.' })
})

// ─── POST /auth/change-password ──────────────────────────────────────────────

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body

  const user = await queryOne<DbUser>(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [req.user!.sub]
  )
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const match = await bcrypt.compare(currentPassword, user.password_hash)
  if (!match) {
    res.status(400).json({ error: 'Current password is incorrect' })
    return
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])

  res.json({ message: 'Password changed successfully.' })
})

export default router
