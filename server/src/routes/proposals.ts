import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { query, queryOne } from '../db'
import { authenticate } from '../middleware/authenticate'
import { requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { smsProposalDecision } from '../lib/sms'
import { emailProposalDecision } from '../lib/email'
import { validate } from '../middleware/validate'
import { reviewProposalSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Multer config — proposal submission is multipart/form-data (title,
// abstract, file), so it needs the same disk-storage handling documents.ts
// uses. Without this, req.body is never populated for the request and the
// route throws trying to destructure it.
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are accepted for proposals'))
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbProposal {
  id: string
  group_id: string
  title: string
  abstract: string
  file_url: string | null
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested'
  version: number
  supervisor_comment: string | null
  submitted_at: string
  updated_at: string
}

interface DbGroup {
  id: string
  leader_id: string
  supervisor_id: string | null
  panel_id: string | null
  period_id: string | null
}

// ─── Helper — verify the requesting user is the group leader ──────────────────

async function assertLeader(groupId: string, userId: string): Promise<DbGroup | null> {
  const group = await queryOne<DbGroup>(
    'SELECT id, leader_id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) return null
  if (group.leader_id !== userId) return null
  return group
}

/** Is this user a member of the group's assigned examination panel? */
async function isPanelMemberOfGroup(group: DbGroup, userId: string): Promise<boolean> {
  if (!group.panel_id) return false
  const m = await queryOne(
    'SELECT 1 FROM panel_members WHERE panel_id = $1 AND user_id = $2',
    [group.panel_id, userId]
  )
  return !!m
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

router.post('/:groupId', requireRole('student'), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { title, abstract } = req.body
  const userId = req.user!.sub

  if (!title?.trim() || !abstract?.trim()) {
    if (req.file) fs.unlinkSync(req.file.path)
    res.status(400).json({ error: 'title and abstract are required' })
    return
  }

  if (!req.file) {
    res.status(400).json({ error: 'A proposal PDF is required' })
    return
  }

  const group = await assertLeader(groupId, userId)
  if (!group) {
    fs.unlinkSync(req.file.path)
    res.status(403).json({ error: 'Only the group leader can submit a proposal' })
    return
  }

  // Enforce proposal deadline
  const deadline = await getProposalDeadline(group.period_id)
  if (deadline && new Date() > deadline) {
    fs.unlinkSync(req.file.path)
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
    fs.unlinkSync(req.file.path)
    res.status(409).json({ error: 'Proposal has already been approved' })
    return
  }

  const newVersion = (current?.version ?? 0) + 1
  const fileUrl = `/uploads/${req.file.filename}`

  const [proposal] = await query<DbProposal>(
    `INSERT INTO proposals (group_id, title, abstract, file_url, status, version)
     VALUES ($1, $2, $3, $4, 'pending', $5)
     RETURNING *`,
    [groupId, title.trim(), abstract.trim(), fileUrl, newVersion]
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
    'SELECT id, leader_id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
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
  if (role === 'supervisor' && group.supervisor_id !== sub && !(await isPanelMemberOfGroup(group, sub))) {
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
    'SELECT id, leader_id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
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
  if (role === 'supervisor' && group.supervisor_id !== sub && !(await isPanelMemberOfGroup(group, sub))) {
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

// ─── PATCH /proposals/:groupId/review — panel approve/reject/request changes ──

router.patch('/:groupId/review', requireRole('supervisor', 'admin'), validate(reviewProposalSchema), async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { status, supervisorComment } = req.body
  const { sub, role } = req.user!
  const comment: string | undefined = supervisorComment

  if (status !== 'approved' && !comment?.trim()) {
    res.status(400).json({ error: 'A comment is required when rejecting or requesting changes' })
    return
  }

  const group = await queryOne<DbGroup>(
    'SELECT id, leader_id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Proposals are decided by the group's assigned supervisor, its
  // examination panel, or an admin
  const isAssignedSupervisor = group.supervisor_id === sub
  if (role !== 'admin' && !isAssignedSupervisor && !(await isPanelMemberOfGroup(group, sub))) {
    res.status(403).json({
      error: group.supervisor_id || group.panel_id
        ? 'Only this group\'s supervisor, its examination panel, or an admin can review its proposal'
        : 'This group has no supervisor or examination panel assigned yet — ask an admin to assign one',
    })
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

  await audit(sub, `proposal.${status}`, 'proposal', proposal.id, {
    groupId, version: proposal.version, comment: comment?.trim(),
  })

  // Notify all group members — SMS for those with a phone, email for everyone
  const members = await query<{ name: string; email: string; phone: string | null }>(
    `SELECT u.name, u.email, u.phone
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = $1`,
    [groupId]
  )
  smsProposalDecision(
    members.filter((m) => m.phone).map((m) => ({ name: m.name, phone: m.phone! })),
    proposal.title,
    status as 'approved' | 'rejected' | 'changes_requested',
    comment?.trim()
  )
  emailProposalDecision(
    members.map((m) => ({ name: m.name, email: m.email })),
    proposal.title,
    status as 'approved' | 'rejected' | 'changes_requested',
    comment?.trim()
  )

  res.json(formatProposal(updated))
})

// ─── GET /proposals — proposals visible to the caller (supervisor/admin) ──────
// Supervisors see proposals of groups they supervise plus groups examined by
// a panel they sit on; admins see everything.

router.get('/', requireRole('supervisor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const { role, sub } = req.user!

  const rows = await query<DbProposal & { group_name: string }>(
    `SELECT p.*, g.name AS group_name
     FROM proposals p
     JOIN groups g ON g.id = p.group_id
     ${role === 'supervisor'
       ? `WHERE g.supervisor_id = $1
          OR g.panel_id IN (SELECT panel_id FROM panel_members WHERE user_id = $1)`
       : ''}
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
