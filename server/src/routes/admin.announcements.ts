import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'

const router = Router()
router.use(authenticate, requireRole('admin'))

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

type AnnouncementType = 'info' | 'warning' | 'deadline' | 'success'

interface DbAnnouncement {
  id:           string
  title:        string
  body:         string
  type:         AnnouncementType
  pinned:       boolean
  published_at: string | null
  expires_at:   string | null
  created_by:   string
  created_at:   string
}

function fmt(a: DbAnnouncement) {
  return {
    id:          a.id,
    title:       a.title,
    body:        a.body,
    type:        a.type,
    pinned:      a.pinned,
    publishedAt: a.published_at,
    expiresAt:   a.expires_at,
    createdBy:   a.created_by,
    createdAt:   a.created_at,
  }
}

// ─── GET /admin/announcements ─────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<DbAnnouncement>(
    `SELECT * FROM announcements ORDER BY pinned DESC, created_at DESC`
  )
  res.json(rows.map(fmt))
})

// ─── POST /admin/announcements ────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { title, body, type = 'info', pinned = false, publishedAt, expiresAt } = req.body
  const { sub } = req.user!

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'title and body are required' })
    return
  }

  const [row] = await query<DbAnnouncement>(
    `INSERT INTO announcements (title, body, type, pinned, published_at, expires_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title.trim(), body.trim(), type, !!pinned, publishedAt ?? null, expiresAt ?? null, sub]
  )

  await audit(sub, 'announcement.created', 'announcement', row.id, { title: row.title })
  res.status(201).json(fmt(row))
})

// ─── PATCH /admin/announcements/:id ──────────────────────────────────────────

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)
  const { sub } = req.user!
  const { title, body, type, pinned, publishedAt, expiresAt } = req.body

  const existing = await queryOne<DbAnnouncement>(
    'SELECT * FROM announcements WHERE id = $1', [id]
  )
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' })
    return
  }

  const [row] = await query<DbAnnouncement>(
    `UPDATE announcements
     SET title        = COALESCE($1, title),
         body         = COALESCE($2, body),
         type         = COALESCE($3, type),
         pinned       = COALESCE($4, pinned),
         published_at = COALESCE($5, published_at),
         expires_at   = COALESCE($6, expires_at)
     WHERE id = $7 RETURNING *`,
    [
      title?.trim() ?? null,
      body?.trim()  ?? null,
      type          ?? null,
      pinned != null ? !!pinned : null,
      publishedAt   ?? null,
      expiresAt     ?? null,
      id,
    ]
  )

  await audit(sub, 'announcement.updated', 'announcement', id, {})
  res.json(fmt(row))
})

// ─── DELETE /admin/announcements/:id ─────────────────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)
  const { sub } = req.user!

  const existing = await queryOne('SELECT id FROM announcements WHERE id = $1', [id])
  if (!existing) {
    res.status(404).json({ error: 'Announcement not found' })
    return
  }

  await query('DELETE FROM announcements WHERE id = $1', [id])
  await audit(sub, 'announcement.deleted', 'announcement', id, {})
  res.status(204).send()
})

export default router
