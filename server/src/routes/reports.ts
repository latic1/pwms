import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'

const router = Router()
router.use(authenticate, requireRole('admin'))

// ─── GET /reports/summary — system-wide counts ────────────────────────────────

router.get('/summary', async (_req: Request, res: Response): Promise<void> => {
  const [groups, users, proposals, tasks, grades, documents] = await Promise.all([
    queryOne<{
      total: string
      with_supervisor: string
      without_supervisor: string
    }>(`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE supervisor_id IS NOT NULL) AS with_supervisor,
        COUNT(*) FILTER (WHERE supervisor_id IS NULL)     AS without_supervisor
      FROM groups
    `),

    queryOne<{
      students: string
      supervisors: string
      admins: string
      panels: string
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'student')    AS students,
        COUNT(*) FILTER (WHERE role = 'supervisor') AS supervisors,
        COUNT(*) FILTER (WHERE role = 'admin')      AS admins,
        (SELECT COUNT(*) FROM panels)               AS panels
      FROM users
    `),

    queryOne<{
      pending: string
      approved: string
      rejected: string
      none: string
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE p.status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE p.status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE p.status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE p.id IS NULL)           AS none
      FROM groups g
      LEFT JOIN LATERAL (
        SELECT id, status FROM proposals WHERE group_id = g.id ORDER BY version DESC LIMIT 1
      ) p ON true
    `),

    queryOne<{ total: string; done: string }>(`
      SELECT
        COUNT(*)                                    AS total,
        COUNT(*) FILTER (WHERE status = 'done')     AS done
      FROM tasks
    `),

    queryOne<{ supervisor_graded: string; panel_graded: string }>(`
      SELECT
        COUNT(DISTINCT group_id) FILTER (WHERE grader_role = 'supervisor') AS supervisor_graded,
        COUNT(DISTINCT group_id) FILTER (WHERE grader_role = 'panel')      AS panel_graded
      FROM grades
    `),

    queryOne<{ total: string; final_reports: string }>(`
      SELECT
        COUNT(*)                                             AS total,
        COUNT(*) FILTER (WHERE type = 'final_report')       AS final_reports
      FROM documents
    `),
  ])

  res.json({
    groups: {
      total:             parseInt(groups?.total ?? '0'),
      withSupervisor:    parseInt(groups?.with_supervisor ?? '0'),
      withoutSupervisor: parseInt(groups?.without_supervisor ?? '0'),
    },
    users: {
      students:    parseInt(users?.students ?? '0'),
      supervisors: parseInt(users?.supervisors ?? '0'),
      admins:      parseInt(users?.admins ?? '0'),
      panels:      parseInt(users?.panels ?? '0'),
    },
    proposals: {
      pending:  parseInt(proposals?.pending ?? '0'),
      approved: parseInt(proposals?.approved ?? '0'),
      rejected: parseInt(proposals?.rejected ?? '0'),
      none:     parseInt(proposals?.none ?? '0'),
    },
    tasks: {
      total: parseInt(tasks?.total ?? '0'),
      done:  parseInt(tasks?.done ?? '0'),
    },
    grades: {
      supervisorGraded: parseInt(grades?.supervisor_graded ?? '0'),
      panelGraded:      parseInt(grades?.panel_graded ?? '0'),
      total:            parseInt(groups?.total ?? '0'),
    },
    documents: {
      total:        parseInt(documents?.total ?? '0'),
      finalReports: parseInt(documents?.final_reports ?? '0'),
    },
  })
})

// ─── GET /reports/groups — per-group breakdown ────────────────────────────────

router.get('/groups', async (_req: Request, res: Response): Promise<void> => {
  const rows = await query<{
    group_id:          string
    group_name:        string
    created_at:        string
    supervisor_name:   string | null
    panel_name:        string | null
    member_count:      string
    proposal_title:    string | null
    proposal_status:   string | null
    proposal_version:  string | null
    task_total:        string
    task_done:         string
    has_final_report:  boolean
    supervisor_score:  string | null
    panel_score:       string | null
    panel_grade_count: string
    doc_count:         string
  }>(`
    SELECT
      g.id                        AS group_id,
      g.name                      AS group_name,
      g.created_at,

      -- Supervisor & panel
      sv.name                     AS supervisor_name,
      pl.name                     AS panel_name,

      -- Member count
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)
                                  AS member_count,

      -- Latest proposal
      p.title                     AS proposal_title,
      p.status                    AS proposal_status,
      p.version                   AS proposal_version,

      -- Tasks
      COALESCE(t.total, 0)        AS task_total,
      COALESCE(t.done,  0)        AS task_done,

      -- Final report submitted?
      EXISTS (
        SELECT 1 FROM documents d
        WHERE d.group_id = g.id AND d.type = 'final_report'
      )                           AS has_final_report,

      -- Grades: panel score = average of panel members' grades
      sg.score                    AS supervisor_score,
      pg.avg_score                AS panel_score,
      COALESCE(pg.grade_count, 0) AS panel_grade_count,

      -- Document count
      COALESCE(dc.total, 0)       AS doc_count

    FROM groups g

    LEFT JOIN users sv ON sv.id = g.supervisor_id
    LEFT JOIN panels pl ON pl.id = g.panel_id

    LEFT JOIN LATERAL (
      SELECT title, status, version
      FROM proposals
      WHERE group_id = g.id
      ORDER BY version DESC
      LIMIT 1
    ) p ON true

    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)                              AS total,
        COUNT(*) FILTER (WHERE status='done') AS done
      FROM tasks WHERE group_id = g.id
    ) t ON true

    LEFT JOIN grades sg ON sg.group_id = g.id AND sg.grader_role = 'supervisor'

    LEFT JOIN LATERAL (
      SELECT AVG(score) AS avg_score, COUNT(*) AS grade_count
      FROM grades WHERE group_id = g.id AND grader_role = 'panel'
    ) pg ON true

    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total FROM documents WHERE group_id = g.id
    ) dc ON true

    ORDER BY g.created_at DESC
  `)

  res.json(
    rows.map((r) => ({
      groupId:          r.group_id,
      groupName:        r.group_name,
      createdAt:        r.created_at,
      supervisorName:   r.supervisor_name ?? null,
      panelName:        r.panel_name ?? null,
      memberCount:      parseInt(r.member_count),
      proposal: r.proposal_status
        ? {
            title:   r.proposal_title,
            status:  r.proposal_status,
            version: parseInt(r.proposal_version ?? '1'),
          }
        : null,
      tasks: {
        total: parseInt(r.task_total),
        done:  parseInt(r.task_done),
      },
      hasFinalReport:  r.has_final_report,
      supervisorScore: r.supervisor_score != null ? parseFloat(r.supervisor_score) : null,
      panelScore:      r.panel_score      != null ? parseFloat(parseFloat(r.panel_score).toFixed(2)) : null,
      panelGradeCount: parseInt(r.panel_grade_count),
      finalScore:
        r.supervisor_score != null && r.panel_score != null
          ? Math.round((parseFloat(r.supervisor_score) + parseFloat(r.panel_score)) / 2)
          : r.supervisor_score != null
          ? Math.round(parseFloat(r.supervisor_score))
          : r.panel_score != null
          ? Math.round(parseFloat(r.panel_score))
          : null,
      docCount: parseInt(r.doc_count),
    }))
  )
})

export default router
