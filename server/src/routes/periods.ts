import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { createPeriodSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

const adminOnly = requireRole('admin')

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbPeriod {
  id: string
  name: string
  group_deadline: string
  proposal_deadline: string
  submission_deadline: string
  grades_released: boolean
  created_at: string
}

function formatPeriod(p: DbPeriod) {
  return {
    id:                 p.id,
    name:               p.name,
    groupDeadline:      p.group_deadline,
    proposalDeadline:   p.proposal_deadline,
    submissionDeadline: p.submission_deadline,
    gradesReleased:     p.grades_released,
    createdAt:          p.created_at,
  }
}

// ─── GET /periods — list all periods ─────────────────────────────────────────

router.get('/', adminOnly, async (_req: Request, res: Response): Promise<void> => {
  const periods = await query<DbPeriod>(
    'SELECT * FROM academic_periods ORDER BY created_at DESC'
  )
  res.json(periods.map(formatPeriod))
})

// ─── GET /periods/active — the most recent period ────────────────────────────

router.get('/active', async (_req: Request, res: Response): Promise<void> => {
  const period = await queryOne<DbPeriod>(
    'SELECT * FROM academic_periods ORDER BY created_at DESC LIMIT 1'
  )
  if (!period) {
    res.status(404).json({ error: 'No academic period configured' })
    return
  }
  res.json(formatPeriod(period))
})

// ─── POST /periods — create a new period ─────────────────────────────────────

router.post('/', adminOnly, validate(createPeriodSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, groupDeadline, proposalDeadline, submissionDeadline } = req.body

  if (!name || !groupDeadline || !proposalDeadline || !submissionDeadline) {
    res.status(400).json({
      error: 'name, groupDeadline, proposalDeadline and submissionDeadline are required',
    })
    return
  }

  // Validate date ordering
  const g = new Date(groupDeadline)
  const pr = new Date(proposalDeadline)
  const s  = new Date(submissionDeadline)

  if (isNaN(g.getTime()) || isNaN(pr.getTime()) || isNaN(s.getTime())) {
    res.status(400).json({ error: 'All deadline fields must be valid dates' })
    return
  }
  if (!(g < pr && pr < s)) {
    res.status(400).json({
      error: 'Deadlines must be in order: groupDeadline < proposalDeadline < submissionDeadline',
    })
    return
  }

  const [period] = await query<DbPeriod>(
    `INSERT INTO academic_periods (name, group_deadline, proposal_deadline, submission_deadline)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name.trim(), groupDeadline, proposalDeadline, submissionDeadline]
  )

  await audit(req.user!.sub, 'period.created', 'period', period.id, { name })
  res.status(201).json(formatPeriod(period))
})

// ─── PATCH /periods/:id — update deadlines or name ───────────────────────────

router.patch('/:id', adminOnly, async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)
  const { name, groupDeadline, proposalDeadline, submissionDeadline } = req.body

  const existing = await queryOne<DbPeriod>(
    'SELECT * FROM academic_periods WHERE id = $1', [id]
  )
  if (!existing) {
    res.status(404).json({ error: 'Academic period not found' })
    return
  }

  // Validate ordering if any deadline changes
  const g  = new Date(groupDeadline      ?? existing.group_deadline)
  const pr = new Date(proposalDeadline   ?? existing.proposal_deadline)
  const s  = new Date(submissionDeadline ?? existing.submission_deadline)

  if (!(g < pr && pr < s)) {
    res.status(400).json({
      error: 'Deadlines must be in order: groupDeadline < proposalDeadline < submissionDeadline',
    })
    return
  }

  const [updated] = await query<DbPeriod>(
    `UPDATE academic_periods
     SET name                = COALESCE($1, name),
         group_deadline      = COALESCE($2, group_deadline),
         proposal_deadline   = COALESCE($3, proposal_deadline),
         submission_deadline = COALESCE($4, submission_deadline)
     WHERE id = $5
     RETURNING *`,
    [name?.trim() ?? null, groupDeadline ?? null, proposalDeadline ?? null, submissionDeadline ?? null, id]
  )

  await audit(req.user!.sub, 'period.updated', 'period', id, { changes: req.body })
  res.json(formatPeriod(updated))
})

// ─── PATCH /periods/:id/release-grades — toggle grade visibility ──────────────

router.patch('/:id/release-grades', adminOnly, async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)
  const { gradesReleased } = req.body

  if (typeof gradesReleased !== 'boolean') {
    res.status(400).json({ error: 'gradesReleased must be a boolean' })
    return
  }

  const existing = await queryOne<DbPeriod>(
    'SELECT * FROM academic_periods WHERE id = $1', [id]
  )
  if (!existing) {
    res.status(404).json({ error: 'Academic period not found' })
    return
  }

  const [updated] = await query<DbPeriod>(
    'UPDATE academic_periods SET grades_released = $1 WHERE id = $2 RETURNING *',
    [gradesReleased, id]
  )

  await audit(req.user!.sub, gradesReleased ? 'grades.released' : 'grades.hidden', 'period', id, {})
  res.json(formatPeriod(updated))
})

// ─── DELETE /periods/:id — delete a period (only if no groups linked) ─────────

router.delete('/:id', adminOnly, async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)

  const existing = await queryOne('SELECT id FROM academic_periods WHERE id = $1', [id])
  if (!existing) {
    res.status(404).json({ error: 'Academic period not found' })
    return
  }

  const linked = await queryOne(
    'SELECT id FROM groups WHERE period_id = $1 LIMIT 1', [id]
  )
  if (linked) {
    res.status(409).json({ error: 'Cannot delete a period that has groups linked to it' })
    return
  }

  await query('DELETE FROM academic_periods WHERE id = $1', [id])
  await audit(req.user!.sub, 'period.deleted', 'period', id, {})
  res.status(204).send()
})

export default router
