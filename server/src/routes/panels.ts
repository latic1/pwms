import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { audit } from '../lib/auditLog'
import { validate } from '../middleware/validate'
import { createPanelSchema, updatePanelSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

const p = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v)

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbPanel {
  id: string
  name: string
  created_at: string
}

interface PanelMemberRow {
  panel_id: string
  id: string
  name: string
  email: string
}

async function getPanelWithDetails(panelId: string) {
  const panel = await queryOne<DbPanel>('SELECT * FROM panels WHERE id = $1', [panelId])
  if (!panel) return null

  const members = await query<PanelMemberRow>(
    `SELECT pm.panel_id, u.id, u.name, u.email
     FROM panel_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.panel_id = $1
     ORDER BY u.name`,
    [panelId]
  )

  const groups = await query<{ id: string; name: string; supervisor_id: string | null }>(
    'SELECT id, name, supervisor_id FROM groups WHERE panel_id = $1 ORDER BY name',
    [panelId]
  )

  return {
    id:        panel.id,
    name:      panel.name,
    createdAt: panel.created_at,
    members:   members.map((m) => ({ id: m.id, name: m.name, email: m.email })),
    groups:    groups.map((g) => ({ id: g.id, name: g.name, supervisorId: g.supervisor_id })),
  }
}

/** Replace a panel's member set, ensuring every member is a supervisor. */
async function setMembers(panelId: string, memberIds: string[]): Promise<string | null> {
  const unique = [...new Set(memberIds)]
  if (unique.length > 0) {
    const supervisors = await query<{ id: string }>(
      "SELECT id FROM users WHERE id = ANY($1::uuid[]) AND role = 'supervisor'",
      [unique]
    )
    if (supervisors.length !== unique.length) {
      return 'All panel members must be supervisors'
    }
  }
  await query('DELETE FROM panel_members WHERE panel_id = $1', [panelId])
  for (const userId of unique) {
    await query('INSERT INTO panel_members (panel_id, user_id) VALUES ($1, $2)', [panelId, userId])
  }
  return null
}

// ─── GET /panels/mine — panels the calling supervisor sits on ────────────────

router.get('/mine', requireRole('supervisor'), async (req: Request, res: Response): Promise<void> => {
  const { sub } = req.user!

  const panels = await query<DbPanel>(
    `SELECT p.* FROM panels p
     JOIN panel_members pm ON pm.panel_id = p.id
     WHERE pm.user_id = $1
     ORDER BY p.name`,
    [sub]
  )

  const result = await Promise.all(
    panels.map(async (panel) => {
      const groups = await query<{
        id: string
        name: string
        supervisor_id: string | null
        member_count: string
        my_score: string | null
        has_final_report: boolean
        proposal_status: string | null
        proposal_title: string | null
        has_supervisor_grade: boolean
        panel_grade_count: string
        result_approved_at: string | null
      }>(
        `SELECT g.id, g.name, g.supervisor_id, g.result_approved_at,
                (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)   AS member_count,
                (SELECT gr.score FROM grades gr
                  WHERE gr.group_id = g.id AND gr.grader_id = $2)                  AS my_score,
                EXISTS (SELECT 1 FROM documents d
                  WHERE d.group_id = g.id AND d.type = 'final_report')             AS has_final_report,
                (SELECT p.status::text FROM proposals p
                  WHERE p.group_id = g.id ORDER BY p.version DESC LIMIT 1)         AS proposal_status,
                (SELECT p.title FROM proposals p
                  WHERE p.group_id = g.id ORDER BY p.version DESC LIMIT 1)         AS proposal_title,
                EXISTS (SELECT 1 FROM grades gr
                  WHERE gr.group_id = g.id AND gr.grader_role = 'supervisor')      AS has_supervisor_grade,
                (SELECT COUNT(*) FROM grades gr
                  WHERE gr.group_id = g.id AND gr.grader_role = 'panel')           AS panel_grade_count
         FROM groups g
         WHERE g.panel_id = $1
         ORDER BY g.name`,
        [panel.id, sub]
      )

      return {
        id:   panel.id,
        name: panel.name,
        groups: groups.map((g) => ({
          id:                 g.id,
          name:               g.name,
          memberCount:        parseInt(g.member_count),
          hasFinalReport:     g.has_final_report,
          myScore:            g.my_score != null ? parseFloat(g.my_score) : null,
          // A member can't panel-grade a group they supervise
          isOwnGroup:         g.supervisor_id === sub,
          proposalStatus:     g.proposal_status,
          proposalTitle:      g.proposal_title,
          hasSupervisorGrade: g.has_supervisor_grade,
          panelGradeCount:    parseInt(g.panel_grade_count),
          resultApproved:     g.result_approved_at != null,
        })),
      }
    })
  )

  res.json(result)
})

// ─── GET /panels — list all panels (admin) ────────────────────────────────────

router.get('/', requireRole('admin'), async (_req: Request, res: Response): Promise<void> => {
  const panels = await query<DbPanel>('SELECT * FROM panels ORDER BY name')
  const full = await Promise.all(panels.map((pl) => getPanelWithDetails(pl.id)))
  res.json(full)
})

// ─── POST /panels — create a panel (admin) ────────────────────────────────────

router.post('/', requireRole('admin'), validate(createPanelSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, memberIds } = req.body

  const dup = await queryOne('SELECT id FROM panels WHERE LOWER(name) = LOWER($1)', [name])
  if (dup) {
    res.status(409).json({ error: 'A panel with that name already exists' })
    return
  }

  const [panel] = await query<DbPanel>(
    'INSERT INTO panels (name) VALUES ($1) RETURNING *',
    [name]
  )

  if (memberIds?.length) {
    const err = await setMembers(panel.id, memberIds)
    if (err) {
      await query('DELETE FROM panels WHERE id = $1', [panel.id])
      res.status(400).json({ error: err })
      return
    }
  }

  await audit(req.user!.sub, 'panel.created', 'panel', panel.id, { name })
  res.status(201).json(await getPanelWithDetails(panel.id))
})

// ─── PATCH /panels/:id — rename / replace members (admin) ─────────────────────

router.patch('/:id', requireRole('admin'), validate(updatePanelSchema), async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)
  const { name, memberIds } = req.body

  const panel = await queryOne<DbPanel>('SELECT * FROM panels WHERE id = $1', [id])
  if (!panel) {
    res.status(404).json({ error: 'Panel not found' })
    return
  }

  if (name && name !== panel.name) {
    const dup = await queryOne('SELECT id FROM panels WHERE LOWER(name) = LOWER($1) AND id <> $2', [name, id])
    if (dup) {
      res.status(409).json({ error: 'A panel with that name already exists' })
      return
    }
    await query('UPDATE panels SET name = $1 WHERE id = $2', [name, id])
  }

  if (memberIds) {
    const err = await setMembers(id, memberIds)
    if (err) {
      res.status(400).json({ error: err })
      return
    }
  }

  await audit(req.user!.sub, 'panel.updated', 'panel', id, { name, memberCount: memberIds?.length })
  res.json(await getPanelWithDetails(id))
})

// ─── DELETE /panels/:id — remove a panel (admin) ──────────────────────────────

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const id = p(req.params.id)

  const panel = await queryOne<DbPanel>('SELECT * FROM panels WHERE id = $1', [id])
  if (!panel) {
    res.status(404).json({ error: 'Panel not found' })
    return
  }

  // groups.panel_id is ON DELETE SET NULL; panel_members cascade
  await query('DELETE FROM panels WHERE id = $1', [id])
  await audit(req.user!.sub, 'panel.deleted', 'panel', id, { name: panel.name })
  res.status(204).send()
})

export default router
