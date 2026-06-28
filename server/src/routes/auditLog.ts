import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'

const router = Router()
router.use(authenticate, requireRole('admin'))

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbLog {
  id: string
  actor_id: string | null
  actor_name: string | null
  actor_role: string | null
  action: string
  target_type: string
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

function formatLog(l: DbLog) {
  return {
    id:         l.id,
    actorId:    l.actor_id,
    actorName:  l.actor_name,
    actorRole:  l.actor_role,
    action:     l.action,
    targetType: l.target_type,
    targetId:   l.target_id,
    metadata:   l.metadata,
    createdAt:  l.created_at,
  }
}

// ─── GET /audit-log — paginated audit log with filters ───────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const page       = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit      = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20))
  const offset     = (page - 1) * limit
  const targetType = req.query.targetType as string | undefined
  const actorId    = req.query.actorId    as string | undefined
  const action     = req.query.action     as string | undefined
  const from       = req.query.from       as string | undefined  // ISO date
  const to         = req.query.to         as string | undefined  // ISO date

  const conditions: string[] = []
  const params: unknown[]    = []

  function addParam(condition: string, value: unknown) {
    params.push(value)
    conditions.push(condition.replace('?', `$${params.length}`))
  }

  if (targetType) addParam('al.target_type = ?', targetType)
  if (actorId)    addParam('al.actor_id = ?',    actorId)
  if (action)     addParam('al.action ILIKE ?',  `%${action}%`)
  if (from)       addParam('al.created_at >= ?', new Date(from).toISOString())
  if (to)         addParam('al.created_at <= ?', new Date(to).toISOString())

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  // Total count
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*) FROM audit_logs al ${where}`,
    params
  )
  const total = parseInt(count)

  // Fetch page
  const logs = await query<DbLog>(
    `SELECT al.*,
            u.name AS actor_name,
            u.role AS actor_role
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ${where}
     ORDER BY al.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  )

  res.json({
    data:       logs.map(formatLog),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
})

// ─── GET /audit-log/:id — single log entry ────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)

  const log = await queryOne<DbLog>(
    `SELECT al.*, u.name AS actor_name, u.role AS actor_role
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     WHERE al.id = $1`,
    [id]
  )

  if (!log) {
    res.status(404).json({ error: 'Log entry not found' })
    return
  }

  res.json(formatLog(log))
})

export default router
