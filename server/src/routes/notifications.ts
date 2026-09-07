import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'

const router = Router()
router.use(authenticate)

interface DbNotification {
  id:         string
  user_id:    string
  type:       string
  title:      string
  body:       string | null
  link:       string | null
  read:       boolean
  created_at: string
}

function formatNotification(n: DbNotification) {
  return {
    id:        n.id,
    type:      n.type,
    title:     n.title,
    body:      n.body,
    link:      n.link,
    read:      n.read,
    createdAt: n.created_at,
  }
}

// ─── GET /notifications — most recent notifications for the current user ─────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub

  const rows = await query<DbNotification>(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 30`,
    [userId]
  )

  res.json(rows.map(formatNotification))
})

// ─── PATCH /notifications/:id/read — mark one notification read ──────────────

router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params
  const userId = req.user!.sub

  const notification = await queryOne('SELECT id FROM notifications WHERE id = $1 AND user_id = $2', [id, userId])
  if (!notification) {
    res.status(404).json({ error: 'Notification not found' })
    return
  }

  await query('UPDATE notifications SET read = TRUE WHERE id = $1', [id])
  res.status(204).send()
})

// ─── POST /notifications/read-all — mark every notification read ─────────────

router.post('/read-all', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub
  await query('UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE', [userId])
  res.status(204).send()
})

export default router
