import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { createTaskSchema, updateTaskStatusSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbTask {
  id: string
  group_id: string
  title: string
  description: string | null
  assignee_id: string | null
  status: 'pending' | 'in_progress' | 'under_review' | 'done'
  due_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

const VALID_STATUSES = ['pending', 'in_progress', 'under_review', 'done']
const STATUS_ORDER   = ['pending', 'in_progress', 'under_review', 'done']

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertGroupAccess(groupId: string, userId: string, role: string) {
  if (role === 'admin') return true

  if (role === 'supervisor') {
    const g = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, userId])
    return !!g
  }

  // student — must be a member
  const m = await queryOne(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  )
  return !!m
}

function formatTask(t: DbTask) {
  return {
    id:          t.id,
    groupId:     t.group_id,
    title:       t.title,
    description: t.description,
    assigneeId:  t.assignee_id,
    status:      t.status,
    dueDate:     t.due_date,
    createdBy:   t.created_by,
    createdAt:   t.created_at,
    updatedAt:   t.updated_at,
  }
}

// ─── GET /tasks/:groupId — list tasks for a group ────────────────────────────

router.get('/:groupId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  const hasAccess = await assertGroupAccess(groupId, sub, role)
  if (!hasAccess) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const { status, assigneeId } = req.query
  const filters: string[] = ['group_id = $1']
  const params: unknown[]  = [groupId]

  if (status && VALID_STATUSES.includes(status as string)) {
    filters.push(`status = $${params.length + 1}`)
    params.push(status)
  }
  if (assigneeId) {
    filters.push(`assignee_id = $${params.length + 1}`)
    params.push(assigneeId)
  }

  const tasks = await query<DbTask>(
    `SELECT * FROM tasks WHERE ${filters.join(' AND ')} ORDER BY due_date ASC NULLS LAST, created_at`,
    params
  )

  res.json(tasks.map(formatTask))
})

// ─── POST /tasks/:groupId — create a task (leader or supervisor) ──────────────

router.post('/:groupId', validate(createTaskSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!
  const { title, description, assigneeId, dueDate } = req.body

  if (!title?.trim()) {
    res.status(400).json({ error: 'title is required' })
    return
  }

  // Students must be leader; supervisors must be assigned
  if (role === 'student') {
    const group = await queryOne<{ leader_id: string }>(
      'SELECT leader_id FROM groups WHERE id = $1', [groupId]
    )
    if (!group || group.leader_id !== sub) {
      res.status(403).json({ error: 'Only the group leader can create tasks' })
      return
    }
  } else if (role === 'supervisor') {
    const g = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, sub])
    if (!g) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  } else if (role !== 'admin') {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  // Verify assignee is a group member (if provided)
  if (assigneeId) {
    const isMember = await queryOne(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, assigneeId]
    )
    if (!isMember) {
      res.status(400).json({ error: 'Assignee must be a member of the group' })
      return
    }
  }

  const [task] = await query<DbTask>(
    `INSERT INTO tasks (group_id, title, description, assignee_id, due_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [groupId, title.trim(), description?.trim() ?? null, assigneeId ?? null, dueDate ?? null, sub]
  )

  await audit(sub, 'task.created', 'task', task.id, { groupId, title: task.title })
  res.status(201).json(formatTask(task))
})

// ─── PATCH /tasks/:groupId/:taskId — update task (assignee updates status; leader/supervisor edits all) ──

router.patch('/:groupId/:taskId', validate(updateTaskStatusSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const taskId  = p(req.params.taskId)
  const { sub, role } = req.user!
  const { title, description, assigneeId, dueDate, status } = req.body

  const task = await queryOne<DbTask>(
    'SELECT * FROM tasks WHERE id = $1 AND group_id = $2',
    [taskId, groupId]
  )
  if (!task) {
    res.status(404).json({ error: 'Task not found' })
    return
  }

  const hasAccess = await assertGroupAccess(groupId, sub, role)
  if (!hasAccess) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  // Students can only update status, and only for tasks assigned to them
  if (role === 'student') {
    const group = await queryOne<{ leader_id: string }>(
      'SELECT leader_id FROM groups WHERE id = $1', [groupId]
    )
    const isLeader = group?.leader_id === sub
    const isAssignee = task.assignee_id === sub

    if (!isLeader && !isAssignee) {
      res.status(403).json({ error: 'You can only update tasks assigned to you' })
      return
    }
    if (!isLeader && (title || description || assigneeId || dueDate)) {
      res.status(403).json({ error: 'Only the group leader can edit task details' })
      return
    }
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
    return
  }

  // Validate forward-only status progression for non-admin/non-supervisor
  if (status && role === 'student') {
    const currentIdx = STATUS_ORDER.indexOf(task.status)
    const newIdx     = STATUS_ORDER.indexOf(status)
    if (newIdx < currentIdx) {
      res.status(400).json({ error: 'Task status can only move forward' })
      return
    }
  }

  const [updated] = await query<DbTask>(
    `UPDATE tasks
     SET title       = COALESCE($1, title),
         description = COALESCE($2, description),
         assignee_id = COALESCE($3, assignee_id),
         due_date    = COALESCE($4, due_date),
         status      = COALESCE($5, status),
         updated_at  = NOW()
     WHERE id = $6
     RETURNING *`,
    [
      title?.trim()    ?? null,
      description?.trim() ?? null,
      assigneeId       ?? null,
      dueDate          ?? null,
      status           ?? null,
      taskId,
    ]
  )

  if (status && status !== task.status) {
    await audit(sub, 'task.status_changed', 'task', taskId, {
      groupId, from: task.status, to: status,
    })
  }

  res.json(formatTask(updated))
})

// ─── DELETE /tasks/:groupId/:taskId — delete task (leader / supervisor / admin) ─

router.delete('/:groupId/:taskId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const taskId  = p(req.params.taskId)
  const { sub, role } = req.user!

  const task = await queryOne<DbTask>(
    'SELECT * FROM tasks WHERE id = $1 AND group_id = $2',
    [taskId, groupId]
  )
  if (!task) {
    res.status(404).json({ error: 'Task not found' })
    return
  }

  if (role === 'student') {
    const group = await queryOne<{ leader_id: string }>(
      'SELECT leader_id FROM groups WHERE id = $1', [groupId]
    )
    if (group?.leader_id !== sub) {
      res.status(403).json({ error: 'Only the group leader can delete tasks' })
      return
    }
  } else if (role === 'supervisor') {
    const g = await queryOne('SELECT id FROM groups WHERE id = $1 AND supervisor_id = $2', [groupId, sub])
    if (!g) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }

  await query('DELETE FROM tasks WHERE id = $1', [taskId])
  await audit(sub, 'task.deleted', 'task', taskId, { groupId, title: task.title })
  res.status(204).send()
})

export default router
