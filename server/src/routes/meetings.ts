import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { createMeetingSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbMeeting {
  id: string
  group_id: string
  supervisor_id: string
  scheduled_at: string
  status: 'proposed' | 'confirmed' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

function formatMeeting(m: DbMeeting) {
  return {
    id:           m.id,
    groupId:      m.group_id,
    supervisorId: m.supervisor_id,
    scheduledAt:  m.scheduled_at,
    status:       m.status,
    notes:        m.notes,
    createdAt:    m.created_at,
    updatedAt:    m.updated_at,
  }
}

// ─── GET /meetings — all meetings for the current supervisor ─────────────────

router.get('/', requireRole('supervisor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { sub, role } = req.user!

  const meetings =
    role === 'admin'
      ? await query<DbMeeting>('SELECT * FROM meetings ORDER BY scheduled_at DESC')
      : await query<DbMeeting>(
          'SELECT * FROM meetings WHERE supervisor_id = $1 ORDER BY scheduled_at DESC',
          [sub]
        )

  res.json(meetings.map(formatMeeting))
})

// ─── GET /meetings/:groupId — list meetings for a group ──────────────────────

router.get('/:groupId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  // Access control
  if (role === 'student') {
    const isMember = await queryOne(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, sub]
    )
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  } else if (role === 'supervisor') {
    const g = await queryOne(
      'SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2',
      [groupId, sub]
    )
    if (!g) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }

  const { status } = req.query
  const params: unknown[] = [groupId]
  let sql = 'SELECT * FROM meetings WHERE group_id = $1'

  if (status && ['proposed', 'confirmed', 'completed'].includes(status as string)) {
    sql += ` AND status = $2`
    params.push(status)
  }

  sql += ' ORDER BY scheduled_at DESC'
  const meetings = await query<DbMeeting>(sql, params)
  res.json(meetings.map(formatMeeting))
})

// ─── POST /meetings/:groupId — schedule a meeting (supervisor only) ───────────

router.post('/:groupId', requireRole('supervisor'), validate(createMeetingSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub } = req.user!
  const { scheduledAt, notes } = req.body

  if (!scheduledAt) {
    res.status(400).json({ error: 'scheduledAt is required' })
    return
  }

  const scheduledDate = new Date(scheduledAt)
  if (isNaN(scheduledDate.getTime())) {
    res.status(400).json({ error: 'scheduledAt must be a valid date' })
    return
  }
  if (scheduledDate < new Date()) {
    res.status(400).json({ error: 'Cannot schedule a meeting in the past' })
    return
  }

  const group = await queryOne<{ supervisor_id: string }>(
    'SELECT supervisor_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }
  if (group.supervisor_id !== sub) {
    res.status(403).json({ error: 'You are not the supervisor of this group' })
    return
  }

  const [meeting] = await query<DbMeeting>(
    `INSERT INTO meetings (group_id, supervisor_id, scheduled_at, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [groupId, sub, scheduledDate.toISOString(), notes?.trim() ?? null]
  )

  await audit(sub, 'meeting.scheduled', 'group', groupId, {
    meetingId: meeting.id, scheduledAt,
  })

  res.status(201).json(formatMeeting(meeting))
})

// ─── PATCH /meetings/:groupId/:meetingId — update status or notes ─────────────

router.patch('/:groupId/:meetingId', async (req: Request, res: Response): Promise<void> => {
  const groupId   = p(req.params.groupId)
  const meetingId = p(req.params.meetingId)
  const { sub, role } = req.user!
  const { status, notes, scheduledAt } = req.body

  const meeting = await queryOne<DbMeeting>(
    'SELECT * FROM meetings WHERE id = $1 AND group_id = $2',
    [meetingId, groupId]
  )
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' })
    return
  }

  // Completed meetings are immutable
  if (meeting.status === 'completed') {
    res.status(409).json({ error: 'Completed meetings cannot be modified' })
    return
  }

  const validStatuses = ['proposed', 'confirmed', 'completed']
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    return
  }

  // Only supervisor can reschedule or mark complete
  // Students (group members) can only confirm
  if (role === 'student') {
    const isMember = await queryOne(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, sub]
    )
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
    if (status && status !== 'confirmed') {
      res.status(403).json({ error: 'Students can only confirm a meeting' })
      return
    }
    if (scheduledAt || notes !== undefined) {
      res.status(403).json({ error: 'Students cannot edit meeting details' })
      return
    }
  } else if (role === 'supervisor') {
    if (meeting.supervisor_id !== sub) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }

  const newScheduledAt = scheduledAt ? new Date(scheduledAt).toISOString() : null

  const [updated] = await query<DbMeeting>(
    `UPDATE meetings
     SET status       = COALESCE($1, status),
         notes        = COALESCE($2, notes),
         scheduled_at = COALESCE($3, scheduled_at),
         updated_at   = NOW()
     WHERE id = $4
     RETURNING *`,
    [status ?? null, notes?.trim() ?? null, newScheduledAt, meetingId]
  )

  if (status && status !== meeting.status) {
    await audit(sub, `meeting.${status}`, 'group', groupId, { meetingId })
  }

  res.json(formatMeeting(updated))
})

// ─── DELETE /meetings/:groupId/:meetingId — cancel a meeting (supervisor/admin) ─

router.delete('/:groupId/:meetingId', requireRole('supervisor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const groupId   = p(req.params.groupId)
  const meetingId = p(req.params.meetingId)
  const { sub, role } = req.user!

  const meeting = await queryOne<DbMeeting>(
    'SELECT * FROM meetings WHERE id = $1 AND group_id = $2',
    [meetingId, groupId]
  )
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' })
    return
  }
  if (role === 'supervisor' && meeting.supervisor_id !== sub) {
    res.status(403).json({ error: 'Access denied' })
    return
  }
  if (meeting.status === 'completed') {
    res.status(409).json({ error: 'Completed meetings cannot be deleted' })
    return
  }

  await query('DELETE FROM meetings WHERE id = $1', [meetingId])
  await audit(sub, 'meeting.cancelled', 'group', groupId, { meetingId })
  res.status(204).send()
})

export default router
