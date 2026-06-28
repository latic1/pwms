import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { requireRole } from '../middleware/authenticate'
import { generateInviteCode } from '../lib/inviteCode'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { createGroupSchema, joinGroupSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbGroup {
  id: string
  name: string
  invite_code: string
  leader_id: string
  supervisor_id: string | null
  period_id: string | null
  created_at: string
}

interface DbMember {
  user_id: string
  name: string
  email: string
  role: string
  index_number: string | null
  department: string | null
  program: string | null
  joined_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatGroup(
  group: DbGroup,
  members: DbMember[],
  supervisor: { id: string; name: string; email: string } | null
) {
  return {
    id:           group.id,
    name:         group.name,
    inviteCode:   group.invite_code,
    leaderId:     group.leader_id,
    supervisorId: group.supervisor_id,
    periodId:     group.period_id,
    createdAt:    group.created_at,
    supervisor,
    members: members.map((m) => ({
      id:          m.user_id,
      name:        m.name,
      email:       m.email,
      role:        m.role,
      indexNumber: m.index_number,
      department:  m.department,
      program:     m.program,
    })),
  }
}

async function getGroupWithMembers(groupId: string) {
  const group = await queryOne<DbGroup>(
    'SELECT * FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) return null

  const members = await query<DbMember>(
    `SELECT u.id AS user_id, u.name, u.email, u.role,
            u.index_number, u.department, u.program,
            gm.joined_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at`,
    [groupId]
  )

  const supervisor = group.supervisor_id
    ? await queryOne<{ id: string; name: string; email: string }>(
        'SELECT id, name, email FROM users WHERE id = $1',
        [group.supervisor_id]
      )
    : null

  return formatGroup(group, members, supervisor)
}

async function getActivePeriod() {
  return queryOne<{
    id: string
    group_deadline: string
    proposal_deadline: string
    submission_deadline: string
  }>(
    `SELECT id, group_deadline, proposal_deadline, submission_deadline
     FROM academic_periods
     ORDER BY created_at DESC LIMIT 1`
  )
}

// ─── POST /groups — create a new group (student only) ────────────────────────

router.post('/', requireRole('student'), validate(createGroupSchema), async (req: Request, res: Response): Promise<void> => {
  const { name } = req.body
  const leaderId = req.user!.sub

  if (!name?.trim()) {
    res.status(400).json({ error: 'Group name is required' })
    return
  }

  // A student can only be in one group
  const existing = await queryOne(
    `SELECT g.id FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1`,
    [leaderId]
  )
  if (existing) {
    res.status(409).json({ error: 'You are already a member of a group' })
    return
  }

  // Enforce group formation deadline
  const period = await getActivePeriod()
  if (period && new Date() > new Date(period.group_deadline)) {
    res.status(403).json({ error: 'Group formation deadline has passed' })
    return
  }

  const inviteCode = await generateInviteCode()

  const [group] = await query<DbGroup>(
    `INSERT INTO groups (name, invite_code, leader_id, period_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name.trim(), inviteCode, leaderId, period?.id ?? null]
  )

  // Add leader as first member
  await query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
    [group.id, leaderId]
  )

  await audit(leaderId, 'group.created', 'group', group.id, { groupName: group.name })

  const full = await getGroupWithMembers(group.id)
  res.status(201).json(full)
})

// ─── POST /groups/join — join via invite code (student) ───────────────────────

router.post('/join', requireRole('student'), validate(joinGroupSchema), async (req: Request, res: Response): Promise<void> => {
  const { inviteCode } = req.body
  const userId = req.user!.sub

  if (!inviteCode?.trim()) {
    res.status(400).json({ error: 'Invite code is required' })
    return
  }

  // Already in a group?
  const alreadyMember = await queryOne(
    `SELECT g.id FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1`,
    [userId]
  )
  if (alreadyMember) {
    res.status(409).json({ error: 'You are already a member of a group' })
    return
  }

  // Enforce deadline
  const period = await getActivePeriod()
  if (period && new Date() > new Date(period.group_deadline)) {
    res.status(403).json({ error: 'Group formation deadline has passed' })
    return
  }

  const group = await queryOne<DbGroup>(
    'SELECT * FROM groups WHERE invite_code = $1',
    [inviteCode.trim().toUpperCase()]
  )
  if (!group) {
    res.status(404).json({ error: 'Invalid invite code' })
    return
  }

  // Enforce max 3 members
  const [{ count }] = await query<{ count: string }>(
    'SELECT COUNT(*) FROM group_members WHERE group_id = $1',
    [group.id]
  )
  if (parseInt(count) >= 3) {
    res.status(409).json({ error: 'This group is already full (max 3 members)' })
    return
  }

  await query(
    'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
    [group.id, userId]
  )

  await audit(userId, 'group.joined', 'group', group.id, { inviteCode })

  const full = await getGroupWithMembers(group.id)
  res.status(200).json(full)
})

// ─── GET /groups/my — current user's group ────────────────────────────────────

router.get('/my', requireRole('student'), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub

  const row = await queryOne<{ group_id: string }>(
    'SELECT group_id FROM group_members WHERE user_id = $1',
    [userId]
  )

  if (!row) {
    res.status(404).json({ error: 'You are not in a group yet' })
    return
  }

  const full = await getGroupWithMembers(row.group_id)
  res.json(full)
})

// ─── GET /groups — list all groups (admin) or supervisor's groups ──────────────

router.get('/', requireRole('admin', 'supervisor', 'examiner'), async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!

  const groups =
    role === 'admin' || role === 'examiner'
      ? await query<DbGroup>('SELECT * FROM groups ORDER BY created_at DESC')
      : await query<DbGroup>(
          'SELECT * FROM groups WHERE supervisor_id = $1 ORDER BY created_at DESC',
          [sub]
        )

  // Attach member counts
  const enriched = await Promise.all(
    groups.map(async (g) => {
      const [{ count }] = await query<{ count: string }>(
        'SELECT COUNT(*) FROM group_members WHERE group_id = $1',
        [g.id]
      )
      return {
        id:           g.id,
        name:         g.name,
        inviteCode:   g.invite_code,
        leaderId:     g.leader_id,
        supervisorId: g.supervisor_id,
        periodId:     g.period_id,
        createdAt:    g.created_at,
        memberCount:  parseInt(count),
      }
    })
  )

  res.json(enriched)
})

// ─── GET /groups/:id — single group detail ────────────────────────────────────

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!
  const group = await getGroupWithMembers(p(req.params.id))

  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Students can only see their own group
  if (role === 'student') {
    const isMember = group.members.some((m) => m.id === sub)
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }

  // Supervisors can only see their assigned groups
  if (role === 'supervisor' && group.supervisorId !== sub) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  // Hide invite code from non-leaders and non-admins
  const canSeeCode = role === 'admin' || group.leaderId === sub
  const response = canSeeCode ? group : { ...group, inviteCode: undefined }

  res.json(response)
})

// ─── PATCH /groups/:id/supervisor — assign supervisor (admin) ─────────────────

router.patch('/:id/supervisor', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { supervisorId } = req.body
  const id = p(req.params.id)

  const group = await queryOne<DbGroup>('SELECT * FROM groups WHERE id = $1', [id])
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  if (supervisorId) {
    const supervisor = await queryOne(
      "SELECT id FROM users WHERE id = $1 AND role = 'supervisor'",
      [supervisorId]
    )
    if (!supervisor) {
      res.status(400).json({ error: 'User not found or is not a supervisor' })
      return
    }
  }

  await query(
    'UPDATE groups SET supervisor_id = $1 WHERE id = $2',
    [supervisorId ?? null, id]
  )

  await audit(req.user!.sub, 'supervisor.assigned', 'group', id, { supervisorId })

  const full = await getGroupWithMembers(id)
  res.json(full)
})

// ─── PATCH /groups/:id/leader — reassign leader (admin only) ─────────────────

router.patch('/:id/leader', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const { leaderId } = req.body
  const id = p(req.params.id)

  const group = await queryOne<DbGroup>('SELECT * FROM groups WHERE id = $1', [id])
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  const isMember = await queryOne(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [id, leaderId]
  )
  if (!isMember) {
    res.status(400).json({ error: 'New leader must already be a member of the group' })
    return
  }

  await query('UPDATE groups SET leader_id = $1 WHERE id = $2', [leaderId, id])
  await audit(req.user!.sub, 'group.leader_changed', 'group', id, { newLeaderId: leaderId })

  const full = await getGroupWithMembers(id)
  res.json(full)
})

// ─── DELETE /groups/:id/members/:userId — remove member (admin or leader) ─────

router.delete('/:id/members/:userId', async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!
  const groupId = p(req.params.id)
  const userId  = p(req.params.userId)

  const group = await queryOne<DbGroup>('SELECT * FROM groups WHERE id = $1', [groupId])
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Only admin or the group leader can remove members
  if (role !== 'admin' && group.leader_id !== sub) {
    res.status(403).json({ error: 'Only the group leader or an admin can remove members' })
    return
  }

  // Cannot remove the leader
  if (userId === group.leader_id) {
    res.status(400).json({ error: 'Cannot remove the group leader. Reassign the leader first.' })
    return
  }

  const isMember = await queryOne(
    'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  )
  if (!isMember) {
    res.status(404).json({ error: 'User is not a member of this group' })
    return
  }

  await query(
    'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  )

  await audit(sub, 'group.member_removed', 'group', groupId, { removedUserId: userId })

  const full = await getGroupWithMembers(groupId)
  res.json(full)
})

export default router
