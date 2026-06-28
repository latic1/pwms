import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import { sendMessageSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbMessage {
  id: string
  group_id: string
  sender_id: string
  body: string
  sent_at: string
}

interface DbMessageWithSender extends DbMessage {
  sender_name: string
  sender_role: string
}

function formatMessage(m: DbMessageWithSender) {
  return {
    id:         m.id,
    groupId:    m.group_id,
    senderId:   m.sender_id,
    senderName: m.sender_name,
    senderRole: m.sender_role,
    body:       m.body,
    sentAt:     m.sent_at,
  }
}

async function assertThreadAccess(groupId: string, userId: string, role: string): Promise<boolean> {
  if (role === 'admin') return true
  if (role === 'examiner') return false // examiners have no messaging access

  if (role === 'supervisor') {
    const g = await queryOne(
      'SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2',
      [groupId, userId]
    )
    return !!g
  }

  // student — must be a member
  const m = await queryOne(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  )
  return !!m
}

// ─── GET /messages/:groupId — fetch thread (paginated) ───────────────────────

router.get('/:groupId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  const ok = await assertThreadAccess(groupId, sub, role)
  if (!ok) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const limit  = Math.min(parseInt(req.query.limit  as string) || 50, 100)
  const before = req.query.before as string | undefined // ISO timestamp for cursor pagination

  const params: unknown[] = [groupId, limit]
  let sql = `
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.group_id = $1
  `

  if (before) {
    sql += ` AND m.sent_at < $3`
    params.push(before)
  }

  sql += ` ORDER BY m.sent_at DESC LIMIT $2`

  const rows = await query<DbMessageWithSender>(sql, params)

  // Return in chronological order (oldest first)
  res.json(rows.reverse().map(formatMessage))
})

// ─── POST /messages/:groupId — send a message ────────────────────────────────

router.post('/:groupId', validate(sendMessageSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!
  const { body } = req.body

  if (!body?.trim()) {
    res.status(400).json({ error: 'Message body is required' })
    return
  }
  if (body.trim().length > 2000) {
    res.status(400).json({ error: 'Message cannot exceed 2000 characters' })
    return
  }

  const ok = await assertThreadAccess(groupId, sub, role)
  if (!ok) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const [message] = await query<DbMessage>(
    `INSERT INTO messages (group_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [groupId, sub, body.trim()]
  )

  // Fetch with sender info to return the full formatted message
  const full = await queryOne<DbMessageWithSender>(
    `SELECT m.*, u.name AS sender_name, u.role AS sender_role
     FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.id = $1`,
    [message.id]
  )

  res.status(201).json(formatMessage(full!))
})

// ─── DELETE /messages/:groupId/:messageId — delete own message ───────────────

router.delete('/:groupId/:messageId', async (req: Request, res: Response): Promise<void> => {
  const groupId   = p(req.params.groupId)
  const messageId = p(req.params.messageId)
  const { sub, role } = req.user!

  const message = await queryOne<DbMessage>(
    'SELECT * FROM messages WHERE id = $1 AND group_id = $2',
    [messageId, groupId]
  )
  if (!message) {
    res.status(404).json({ error: 'Message not found' })
    return
  }

  if (role !== 'admin' && message.sender_id !== sub) {
    res.status(403).json({ error: 'You can only delete your own messages' })
    return
  }

  await query('DELETE FROM messages WHERE id = $1', [messageId])
  res.status(204).send()
})

export default router
