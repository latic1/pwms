import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { smsProposalDecision } from '../lib/sms'
import { validate } from '../middleware/validate'
import { reviewProposalSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbProposal {
  id: string
  group_id: string
  title: string
  abstract: string
  file_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  version: number
  supervisor_comment: string | null
  submitted_at: string
  updated_at: string
}

interface DbGroup {
  id: string
  leader_id: string
  supervisor_id: string | null
  period_id: string | null
}

// ─── Helper — verify the requesting user is the group leader ──────────────────

async function assertLeader(groupId: string, userId: string): Promise<DbGroup | null> {
  const group = await queryOne<DbGroup>(
    'SELECT id, leader_id, supervisor_id, period_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) return null
  if (group.leader_id !== userId) return null
  return group
}

// ─── Helper — get proposal deadline for group's period ───────────────────────

async function getProposalDeadline(periodId: string | null): Promise<Date | null> {
  if (!periodId) return null
  const period = await queryOne<{ proposal_deadline: string }>(
    'SELECT proposal_deadline FROM academic_periods WHERE id = $1',
    [periodId]
  )
  return period ? new Date(period.proposal_deadline) : null
}

// ─── POST /proposals/:groupId — submit/resubmit a proposal (leader only) ──────

router.post('/:groupId', requireRole('student'), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { title, abstract, fileUrl } = req.body
  const userId = req.user!.sub

  if (!title?.trim() || !abstract?.trim()) {
    res.status(400).json({ error: 'title and abstract are required' })
    return
  }

  const group = await assertLeader(groupId, userId)
  if (!group) {
    res.status(403).json({ error: 'Only the group leader can submit a proposal' })
    return
  }

  // Enforce proposal deadline
  const deadline = await getProposalDeadline(group.period_id)
  if (deadline && new Date() > deadline) {
    res.status(403).json({ error: 'Proposal submission deadline has passed' })
    return
  }

  // Get current proposal (if any) to determine version
  const current = await queryOne<DbProposal>(
    'SELECT * FROM proposals WHERE group_id = $1 ORDER BY version DESC LIMIT 1',
    [groupId]
  )

  // Cannot resubmit an approved proposal
  if (current?.status === 'approved') {
    res.status(409).json({ error: 'Proposal has already been approved' })
    return
  }

  const newVersion = (current?.version ?? 0) + 1

  const [proposal] = await query<DbProposal>(
    `INSERT INTO proposals (group_id, title, abstract, file_url, status, version)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [groupId, title.trim(), abstract.trim(), fileUrl ?? null, newVersion]
  )

  await audit(userId, 'proposal.submitted', 'proposal', proposal.id, {
    groupId, version: newVersion,
  })

  res.status(201).json(formatProposal(proposal))
})

// ─── GET /proposals/:groupId/history — all versions for a group ───────────────

router.get('/:groupId/history', async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!
  const groupId = p(req.params.groupId)

  const group = await queryOne<DbGroup>(
    'SELECT id, leader_id, supervisor_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

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
  }
  if (role === 'supervisor' && group.supervisor_id !== sub) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const proposals = await query<DbProposal>(
    'SELECT * FROM proposals WHERE group_id = $1 ORDER BY version DESC',
    [groupId]
  )

  res.json(proposals.map(formatProposal))
})

// ─── GET /proposals/:groupId/latest — most recent version ─────────────────────

router.get('/:groupId/latest', async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!
  const groupId = p(req.params.groupId)

  const group = await queryOne<DbGroup>(
    'SELECT id, leader_id, supervisor_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  if (role === 'student') {
    const isMember = await queryOne(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, sub]
    )
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }
  if (role === 'supervisor' && group.supervisor_id !== sub) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const proposal = await queryOne<DbProposal>(
    'SELECT * FROM proposals WHERE group_id = $1 ORDER BY version DESC LIMIT 1',
    [groupId]
  )

  if (!proposal) {
    res.status(404).json({ error: 'No proposal submitted yet' })
    return
  }

  res.json(formatProposal(proposal))
})

// ─── PATCH /proposals/:groupId/review — supervisor approve/reject ─────────────

router.patch('/:groupId/review', requireRole('supervisor'), validate(reviewProposalSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { status, comment } = req.body
  const supervisorId = req.user!.sub

  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be "approved" or "rejected"' })
    return
  }
  if (status === 'rejected' && !comment?.trim()) {
    res.status(400).json({ error: 'A comment is required when rejecting a proposal' })
    return
  }

  const group = await queryOne<DbGroup>(
    'SELECT id, supervisor_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }
  if (group.supervisor_id !== supervisorId) {
    res.status(403).json({ error: 'You are not the supervisor of this group' })
    return
  }

  const proposal = await queryOne<DbProposal>(
    `SELECT * FROM proposals WHERE group_id = $1
     ORDER BY version DESC LIMIT 1`,
    [groupId]
  )
  if (!proposal) {
    res.status(404).json({ error: 'No proposal found for this group' })
    return
  }
  if (proposal.status !== 'pending') {
    res.status(409).json({ error: 'This proposal has already been reviewed' })
    return
  }

  const [updated] = await query<DbProposal>(
    `UPDATE proposals
     SET status = $1, supervisor_comment = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [status, comment?.trim() ?? null, proposal.id]
  )

  await audit(supervisorId, `proposal.${status}`, 'proposal', proposal.id, {
    groupId, version: proposal.version, comment: comment?.trim(),
  })

  // SMS all group members who have a phone number
  const members = await query<{ name: string; phone: string | null }>(
    `SELECT u.name, u.phone
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  )
  smsProposalDecision(
    members.filter((m) => m.phone).map((m) => ({ name: m.name, phone: m.phone! })),
    proposal.title,
    status,
    comment?.trim()
  )

  res.json(formatProposal(updated))
})

// ─── GET /proposals/pending — all pending proposals (supervisor/admin) ─────────

router.get('/', requireRole('supervisor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!

  const rows = await query<DbProposal & { group_name: string }>(
    `SELECT p.*, g.name AS group_name
     FROM proposals p
     JOIN groups g ON g.id = p.group_id
     ${role === 'supervisor' ? 'WHERE g.supervisor_id = $1' : ''}
     ORDER BY p.submitted_at DESC`,
    role === 'supervisor' ? [sub] : []
  )

  res.json(rows.map((r) => ({ ...formatProposal(r), groupName: r.group_name })))
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatProposal(p: DbProposal) {
  return {
    id:                p.id,
    groupId:           p.group_id,
    title:             p.title,
    abstract:          p.abstract,
    fileUrl:           p.file_url,
    status:            p.status,
    version:           p.version,
    supervisorComment: p.supervisor_comment,
    submittedAt:       p.submitted_at,
    updatedAt:         p.updated_at,
  }
}

export default router
