/**
 * Public routes — no authentication required.
 * Exposes project archive, announcements, and basic stats for the landing page.
 */
import { Router, Request, Response } from 'express'
import { query } from '../db'

const router = Router()

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbProject {
  group_id:        string
  group_name:      string
  proposal_title:  string
  abstract:        string
  department:      string | null
  program:         string | null
  supervisor_name: string | null
  period_name:     string | null
  period_year:     string | null
  avg_score:       string | null
  grade_count:     string
  member_count:    string
}

interface DbAnnouncement {
  id:           string
  title:        string
  body:         string
  type:         string
  pinned:       boolean
  published_at: string
  expires_at:   string | null
}

// ─── GET /public/announcements ────────────────────────────────────────────────

router.get('/announcements', async (_req: Request, res: Response): Promise<void> => {
  const now = new Date().toISOString()
  const rows = await query<DbAnnouncement>(
    `SELECT id, title, body, type, pinned, published_at, expires_at
     FROM announcements
     WHERE published_at IS NOT NULL
       AND published_at <= $1
       AND (expires_at IS NULL OR expires_at > $1)
     ORDER BY pinned DESC, published_at DESC
     LIMIT 20`,
    [now]
  )
  res.json(rows)
})

// ─── GET /public/projects ─────────────────────────────────────────────────────
// Filters: department, year, supervisor, search (title/abstract keyword)
// Only returns groups that have an approved proposal

router.get('/projects', async (req: Request, res: Response): Promise<void> => {
  const { department, year, supervisor, search, limit = '50', offset = '0' } = req.query as Record<string, string>

  const conditions: string[] = ['p.status = $1']
  const params: unknown[] = ['approved']
  let i = 2

  if (department) {
    conditions.push(`u.department ILIKE $${i++}`)
    params.push(`%${department}%`)
  }
  if (year) {
    conditions.push(`ap.name ILIKE $${i++}`)
    params.push(`%${year}%`)
  }
  if (supervisor) {
    conditions.push(`sv.name ILIKE $${i++}`)
    params.push(`%${supervisor}%`)
  }
  if (search) {
    conditions.push(`(p.title ILIKE $${i} OR p.abstract ILIKE $${i})`)
    params.push(`%${search}%`)
    i++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const sql = `
    SELECT
      g.id                                                        AS group_id,
      g.name                                                      AS group_name,
      p.title                                                     AS proposal_title,
      p.abstract,
      MAX(u.department)                                           AS department,
      MAX(u.program)                                              AS program,
      sv.name                                                     AS supervisor_name,
      ap.name                                                     AS period_name,
      EXTRACT(YEAR FROM ap.submission_deadline)::TEXT             AS period_year,
      ROUND(AVG(gr.score)::NUMERIC, 1)::TEXT                     AS avg_score,
      COUNT(DISTINCT gr.id)::TEXT                                 AS grade_count,
      COUNT(DISTINCT gm.user_id)::TEXT                           AS member_count
    FROM proposals p
    JOIN groups       g   ON g.id = p.group_id
    LEFT JOIN users   sv  ON sv.id = g.supervisor_id
    LEFT JOIN academic_periods ap ON ap.id = g.period_id
    LEFT JOIN group_members gm    ON gm.group_id = g.id
    LEFT JOIN users   u   ON u.id = gm.user_id AND u.role = 'student'
    LEFT JOIN grades  gr  ON gr.group_id = g.id
    ${where}
    GROUP BY g.id, g.name, p.title, p.abstract, sv.name, ap.name, ap.submission_deadline
    ORDER BY avg_score DESC NULLS LAST, g.name
    LIMIT $${i} OFFSET $${i + 1}
  `

  params.push(parseInt(limit, 10) || 50, parseInt(offset, 10) || 0)

  const projects = await query<DbProject>(sql, params)

  res.json(
    projects.map((r) => ({
      groupId:       r.group_id,
      groupName:     r.group_name,
      title:         r.proposal_title,
      abstract:      r.abstract,
      department:    r.department,
      program:       r.program,
      supervisorName:r.supervisor_name,
      periodName:    r.period_name,
      periodYear:    r.period_year,
      avgScore:      r.avg_score ? parseFloat(r.avg_score) : null,
      gradeCount:    parseInt(r.grade_count, 10),
      memberCount:   parseInt(r.member_count, 10),
    }))
  )
})

// ─── GET /public/stats ────────────────────────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const [groups, students, proposals, periods] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*)::TEXT AS count FROM groups'),
    query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM users WHERE role = 'student'`),
    query<{ count: string }>(`SELECT COUNT(*)::TEXT AS count FROM proposals WHERE status = 'approved'`),
    query<{ count: string }>('SELECT COUNT(*)::TEXT AS count FROM academic_periods'),
  ])

  res.json({
    groups:         parseInt(groups[0]?.count ?? '0', 10),
    students:       parseInt(students[0]?.count ?? '0', 10),
    approvedProposals: parseInt(proposals[0]?.count ?? '0', 10),
    periods:        parseInt(periods[0]?.count ?? '0', 10),
  })
})

// ─── GET /public/departments ──────────────────────────────────────────────────
// Used for filter dropdowns

router.get('/departments', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<{ department: string }>(
    `SELECT DISTINCT department FROM users
     WHERE role = 'student' AND department IS NOT NULL
     ORDER BY department`
  )
  res.json(rows.map((r) => r.department))
})

router.get('/supervisors', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE role = 'supervisor' ORDER BY name`
  )
  res.json(rows)
})

export default router
