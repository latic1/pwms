import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { submitGradeSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbGrade {
  id: string
  group_id: string
  grader_id: string
  grader_role: 'supervisor' | 'panel'
  score: string       // numeric comes back as string from pg
  rubric: Record<string, number>
  feedback: string | null
  graded_at: string
}

interface DbGroup {
  id: string
  supervisor_id: string | null
  panel_id: string | null
  period_id: string | null
}

/** Is this supervisor a member of the group's assigned panel? */
async function isPanelMember(group: DbGroup, userId: string): Promise<boolean> {
  if (!group.panel_id) return false
  const m = await queryOne(
    'SELECT 1 FROM panel_members WHERE panel_id = $1 AND user_id = $2',
    [group.panel_id, userId]
  )
  return !!m
}

function formatGrade(g: DbGrade) {
  return {
    id:         g.id,
    groupId:    g.group_id,
    graderId:   g.grader_id,
    graderRole: g.grader_role,
    score:      parseFloat(g.score),
    rubric:     g.rubric,
    feedback:   g.feedback,
    gradedAt:   g.graded_at,
  }
}

// ─── POST /grades/:groupId — submit a grade (group supervisor or panel member) ─

router.post(
  '/:groupId',
  requireRole('supervisor'),
  validate(submitGradeSchema),
  async (req: Request, res: Response): Promise<void> => {
    const groupId = p(req.params.groupId)
    const { sub } = req.user!
    const { score, rubric, feedback } = req.body

    if (score === undefined || score === null) {
      res.status(400).json({ error: 'score is required' })
      return
    }

    const numScore = parseFloat(score)
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      res.status(400).json({ error: 'score must be a number between 0 and 100' })
      return
    }

    const group = await queryOne<DbGroup>(
      'SELECT id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
      [groupId]
    )
    if (!group) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    // In what capacity is this supervisor grading? Their own supervised group
    // → supervisor grade; a member of the group's assigned panel → panel grade.
    let graderRole: 'supervisor' | 'panel'
    if (group.supervisor_id === sub) {
      graderRole = 'supervisor'
    } else if (await isPanelMember(group, sub)) {
      graderRole = 'panel'
    } else {
      res.status(403).json({ error: 'You are neither the supervisor of this group nor on its examination panel' })
      return
    }

    // Check grades are not already released — prevent grading after release
    if (group.period_id) {
      const period = await queryOne<{ grades_released: boolean }>(
        'SELECT grades_released FROM academic_periods WHERE id = $1',
        [group.period_id]
      )
      if (period?.grades_released) {
        res.status(409).json({ error: 'Grades have already been released for this period' })
        return
      }
    }

    // Upsert — one grade per grader per group (enforced by DB UNIQUE constraint too)
    const [grade] = await query<DbGrade>(
      `INSERT INTO grades (group_id, grader_id, grader_role, score, rubric, feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (group_id, grader_id)
       DO UPDATE SET
         score     = EXCLUDED.score,
         rubric    = EXCLUDED.rubric,
         feedback  = EXCLUDED.feedback,
         graded_at = NOW()
       RETURNING *`,
      [
        groupId,
        sub,
        graderRole,
        numScore,
        rubric ? JSON.stringify(rubric) : '{}',
        feedback?.trim() ?? null,
      ]
    )

    await audit(sub, 'grade.submitted', 'group', groupId, {
      graderRole, score: numScore,
    })

    res.status(201).json(formatGrade(grade))
  }
)

// ─── GET /grades/:groupId — view grades for a group ──────────────────────────

router.get('/:groupId', async (req: Request, res: Response): Promise<void> => {
  const groupId = p(req.params.groupId)
  const { sub, role } = req.user!

  const group = await queryOne<DbGroup>(
    'SELECT id, supervisor_id, panel_id, period_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // Students can only see grades if released
  if (role === 'student') {
    const isMember = await queryOne(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, sub]
    )
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    if (group.period_id) {
      const period = await queryOne<{ grades_released: boolean }>(
        'SELECT grades_released FROM academic_periods WHERE id = $1',
        [group.period_id]
      )
      if (!period?.grades_released) {
        res.status(403).json({ error: 'Grades have not been released yet' })
        return
      }
    } else {
      res.status(403).json({ error: 'Grades have not been released yet' })
      return
    }
  }

  // Supervisors can see grades for their own group or groups their panel examines
  if (role === 'supervisor' && group.supervisor_id !== sub && !(await isPanelMember(group, sub))) {
    res.status(403).json({ error: 'Access denied' })
    return
  }

  const grades = await query<DbGrade>(
    'SELECT * FROM grades WHERE group_id = $1 ORDER BY graded_at',
    [groupId]
  )

  // Aggregate: panel score = average of panel members' grades;
  // final = average of the supervisor score and the panel score.
  const formatted = grades.map(formatGrade)
  const supervisorGrade = formatted.find((g) => g.graderRole === 'supervisor') ?? null
  const panelGrades     = formatted.filter((g) => g.graderRole === 'panel')

  const panelAverage = panelGrades.length
    ? parseFloat((panelGrades.reduce((s, g) => s + g.score, 0) / panelGrades.length).toFixed(2))
    : null

  const parts = [supervisorGrade?.score, panelAverage].filter((v): v is number => v != null)
  const finalScore = parts.length
    ? parseFloat((parts.reduce((s, v) => s + v, 0) / parts.length).toFixed(2))
    : null

  res.json({
    grades:          formatted,
    supervisorScore: supervisorGrade?.score ?? null,
    panelAverage,
    panelCount:      panelGrades.length,
    finalScore,
    // Kept for backwards compatibility with existing clients
    average: finalScore,
    count:   formatted.length,
  })
})

// ─── GET /grades/:groupId/mine — grader views their own grade ─────────────────

router.get(
  '/:groupId/mine',
  requireRole('supervisor'),
  async (req: Request, res: Response): Promise<void> => {
    const groupId = p(req.params.groupId)
    const { sub } = req.user!

    const grade = await queryOne<DbGrade>(
      'SELECT * FROM grades WHERE group_id = $1 AND grader_id = $2',
      [groupId, sub]
    )

    if (!grade) {
      res.status(404).json({ error: 'You have not graded this group yet' })
      return
    }

    res.json(formatGrade(grade))
  }
)

// ─── DELETE /grades/:groupId — retract grade before release (own grade only) ──

router.delete(
  '/:groupId',
  requireRole('supervisor'),
  async (req: Request, res: Response): Promise<void> => {
    const groupId = p(req.params.groupId)
    const { sub } = req.user!

    const group = await queryOne<DbGroup>(
      'SELECT period_id FROM groups WHERE id = $1',
      [groupId]
    )
    if (!group) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    if (group.period_id) {
      const period = await queryOne<{ grades_released: boolean }>(
        'SELECT grades_released FROM academic_periods WHERE id = $1',
        [group.period_id]
      )
      if (period?.grades_released) {
        res.status(409).json({ error: 'Cannot retract a grade after grades have been released' })
        return
      }
    }

    const grade = await queryOne(
      'SELECT id FROM grades WHERE group_id = $1 AND grader_id = $2',
      [groupId, sub]
    )
    if (!grade) {
      res.status(404).json({ error: 'No grade found to retract' })
      return
    }

    await query('DELETE FROM grades WHERE group_id = $1 AND grader_id = $2', [groupId, sub])
    await audit(sub, 'grade.retracted', 'group', groupId, {})
    res.status(204).send()
  }
)

export default router
