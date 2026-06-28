import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import multer from 'multer'
import * as XLSX from 'xlsx'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import { createUserSchema, updateUserSchema } from '../lib/schemas'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/** Generate a readable temporary password like "Kq7#mPx2" */
function generateTempPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#'
  return Array.from(crypto.randomBytes(10))
    .map((b) => chars[b % chars.length])
    .join('')
}

const router = Router()

// All routes in this file require admin role
router.use(authenticate, requireRole('admin'))

interface DbUser {
  id: string
  name: string
  email: string
  role: string
  index_number: string | null
  department: string | null
  program: string | null
  created_at: string
}

// ─── GET /admin/users ─────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const users = await query<DbUser>(
    `SELECT id, name, email, role, index_number, department, program, created_at
     FROM users
     ORDER BY created_at DESC`
  )

  res.json(users.map(toSafeUser))
})

// ─── POST /admin/users ────────────────────────────────────────────────────────

router.post('/', validate(createUserSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, email, role, indexNumber, department, program } = req.body

  if (!name || !email || !role) {
    res.status(400).json({ error: 'name, email and role are required' })
    return
  }

  const validRoles = ['student', 'supervisor', 'admin', 'examiner']
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
    return
  }

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [
    email.toLowerCase().trim(),
  ])
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists' })
    return
  }

  if (role === 'student' && indexNumber) {
    const dupIndex = await queryOne('SELECT id FROM users WHERE index_number = $1', [indexNumber])
    if (dupIndex) {
      res.status(409).json({ error: 'A student with that index number already exists' })
      return
    }
  }

  // Auto-generate a temporary password — returned once to the admin
  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const [newUser] = await query<DbUser>(
    `INSERT INTO users (name, email, password_hash, role, index_number, department, program)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, email, role, index_number, department, program, created_at`,
    [
      name.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      role,
      role === 'student' ? (indexNumber ?? null) : null,
      role === 'student' ? (department ?? null)  : null,
      role === 'student' ? (program ?? null)      : null,
    ]
  )

  // Return the temp password once — admin must share it with the user
  res.status(201).json({ ...toSafeUser(newUser), tempPassword })
})

// ─── PATCH /admin/users/:id ───────────────────────────────────────────────────

router.patch('/:id', validate(updateUserSchema), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const { name, role, indexNumber, department, program } = req.body

  const user = await queryOne<DbUser>('SELECT * FROM users WHERE id = $1', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const updatedUser = await queryOne<DbUser>(
    `UPDATE users
     SET name         = COALESCE($1, name),
         role         = COALESCE($2, role),
         index_number = CASE WHEN $2 = 'student' THEN COALESCE($3, index_number) ELSE NULL END,
         department   = CASE WHEN $2 = 'student' THEN COALESCE($4, department)   ELSE NULL END,
         program      = CASE WHEN $2 = 'student' THEN COALESCE($5, program)      ELSE NULL END
     WHERE id = $6
     RETURNING id, name, email, role, index_number, department, program, created_at`,
    [name ?? null, role ?? null, indexNumber ?? null, department ?? null, program ?? null, id]
  )

  res.json(toSafeUser(updatedUser!))
})

// ─── POST /admin/users/bulk — import students from Excel/CSV ─────────────────
// Expected columns (case-insensitive): name, email, indexNumber, department, program
// Returns: { created: [], skipped: [] } where created rows include tempPassword

router.post('/bulk', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  let rows: Record<string, string>[]
  try {
    const wb   = XLSX.read(req.file.buffer, { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
  } catch {
    res.status(400).json({ error: 'Could not parse file. Use .xlsx or .csv format.' })
    return
  }

  if (rows.length === 0) {
    res.status(400).json({ error: 'File is empty or has no data rows.' })
    return
  }

  if (rows.length > 200) {
    res.status(400).json({ error: 'Maximum 200 rows per import.' })
    return
  }

  // Normalise header names — accept any casing / spacing
  function col(row: Record<string, string>, ...keys: string[]): string {
    for (const k of keys) {
      const match = Object.keys(row).find((rk) => rk.toLowerCase().replace(/[\s_]/g, '') === k.toLowerCase().replace(/[\s_]/g, ''))
      if (match && row[match]?.toString().trim()) return row[match].toString().trim()
    }
    return ''
  }

  const created: object[] = []
  const skipped: { row: number; email: string; reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row   = rows[i]
    const rowNo = i + 2 // 1-indexed + header row

    const name        = col(row, 'name', 'fullname', 'studentname')
    const email       = col(row, 'email', 'emailaddress').toLowerCase()
    const indexNumber = col(row, 'indexnumber', 'index', 'indexno', 'studentid')
    const department  = col(row, 'department', 'dept')
    const program     = col(row, 'program', 'programme', 'course')

    if (!name || !email) {
      skipped.push({ row: rowNo, email: email || '—', reason: 'Missing name or email' })
      continue
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ row: rowNo, email, reason: 'Invalid email format' })
      continue
    }

    const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE email = $1', [email])
    if (existing) {
      skipped.push({ row: rowNo, email, reason: 'Email already registered' })
      continue
    }

    if (indexNumber) {
      const dupIdx = await queryOne<{ id: string }>('SELECT id FROM users WHERE index_number = $1', [indexNumber])
      if (dupIdx) {
        skipped.push({ row: rowNo, email, reason: 'Index number already registered' })
        continue
      }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await bcrypt.hash(tempPassword, 10)

    const [newUser] = await query<DbUser>(
      `INSERT INTO users (name, email, password_hash, role, index_number, department, program)
       VALUES ($1, $2, $3, 'student', $4, $5, $6)
       RETURNING id, name, email, role, index_number, department, program, created_at`,
      [name, email, passwordHash, indexNumber || null, department || null, program || null]
    )

    created.push({ ...toSafeUser(newUser), tempPassword })
  }

  res.status(201).json({
    summary: { total: rows.length, created: created.length, skipped: skipped.length },
    created,
    skipped,
  })
})

// ─── POST /admin/users/:id/reset-password ────────────────────────────────────

router.post('/:id/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  const user = await queryOne<DbUser>('SELECT id, name, email FROM users WHERE id = $1', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id])

  res.json({ tempPassword })
})

// ─── DELETE /admin/users/:id ──────────────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params

  // Prevent deleting yourself
  if (id === req.user!.sub) {
    res.status(400).json({ error: 'You cannot delete your own account' })
    return
  }

  const user = await queryOne('SELECT id FROM users WHERE id = $1', [id])
  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  await query('DELETE FROM users WHERE id = $1', [id])
  res.status(204).send()
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function toSafeUser(u: DbUser) {
  return {
    id:          u.id,
    name:        u.name,
    email:       u.email,
    role:        u.role,
    indexNumber: u.index_number,
    department:  u.department,
    program:     u.program,
    createdAt:   u.created_at,
  }
}

export default router
