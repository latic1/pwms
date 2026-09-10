import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import { suggestTopicsSchema, matchSupervisorsSchema } from '../lib/schemas'
import { suggestTopics, explainSupervisorMatches } from '../lib/gemini'
import { rankSupervisors, extractKeywords, SupervisorCandidate } from '../lib/supervisorMatch'
import { audit } from '../lib/auditLog'
import { notifyMany, getAdminIds } from '../lib/notify'

const router = Router()
router.use(authenticate)

// Protects the free Gemini quota — shared by every route that calls out to it.
const geminiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please try again later.' },
})

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbTopicSuggestion {
  id:           string
  requested_by: string
  interests:    string
  suggestions:  unknown
  created_at:   string
}

interface DbSupervisorCandidate {
  id:          string
  name:        string
  email:       string
  department:  string | null
  expertise:   string | null
  group_count: string
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

/** Every active supervisor, with their current group load. Deactivated
 * supervisors are excluded — they can't be assigned anyway. */
async function getSupervisorCandidates(): Promise<SupervisorCandidate[]> {
  const rows = await query<DbSupervisorCandidate>(
    `SELECT u.id, u.name, u.email, u.department, u.expertise, COUNT(g.id) AS group_count
     FROM users u
     LEFT JOIN groups g ON g.supervisor_id = u.id
     WHERE u.role = 'supervisor' AND u.is_active = TRUE
     GROUP BY u.id`
  )
  return rows.map((c) => ({
    id:         c.id,
    name:       c.name,
    email:      c.email,
    department: c.department,
    expertise:  c.expertise,
    groupCount: Number(c.group_count),
  }))
}

/**
 * rankSupervisors() plus the best-effort Gemini re-rank/explain layer,
 * merged into one ordered list. On any AI failure this just falls back to
 * the plain rule-based order with no explanation — never blocks.
 */
async function rankAndExplain(topicTitle: string, keywords: string[], department: string | null) {
  const candidates = await getSupervisorCandidates()
  const matches = rankSupervisors(candidates, keywords, department)

  const expertiseById = new Map(candidates.map((c) => [c.id, c.expertise]))
  const explanations = await explainSupervisorMatches(
    topicTitle,
    keywords,
    matches.map((m) => ({
      supervisorId:    m.supervisorId,
      name:            m.name,
      expertise:       expertiseById.get(m.supervisorId) ?? null,
      score:           m.score,
      matchedKeywords: m.matchedKeywords,
    }))
  )

  const reasonById = new Map(explanations.map((e) => [e.supervisorId, e.reason]))
  const ordered = explanations.length === matches.length
    ? explanations
        .map((e) => matches.find((m) => m.supervisorId === e.supervisorId))
        .filter((m): m is typeof matches[number] => Boolean(m))
    : matches

  return {
    matches: ordered.map((m) => ({ ...m, reason: reasonById.get(m.supervisorId) ?? null })),
    aiExplained: explanations.length > 0,
  }
}

// ─── POST /ai/topics — generate topic suggestions ─────────────────────────────

router.post(
  '/topics',
  requireRole('student'),
  geminiLimiter,
  validate(suggestTopicsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub
    const { interests } = req.body

    const student = await queryOne<{ department: string | null }>(
      'SELECT department FROM users WHERE id = $1',
      [userId]
    )

    const suggestions = await suggestTopics(interests, student?.department ?? null)

    const row = await queryOne<DbTopicSuggestion>(
      `INSERT INTO topic_suggestions (requested_by, interests, suggestions)
       VALUES ($1, $2, $3)
       RETURNING id, requested_by, interests, suggestions, created_at`,
      [userId, interests.join(', '), JSON.stringify(suggestions)]
    )

    await audit(userId, 'ai.topics_generated', 'topic_suggestion', row!.id, { interests })

    res.status(201).json({
      id:          row!.id,
      interests:   row!.interests,
      suggestions,
      createdAt:   row!.created_at,
    })
  }
)

// ─── GET /ai/topics — this student's suggestion history ───────────────────────

router.get('/topics', requireRole('student'), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub

  const rows = await query<DbTopicSuggestion>(
    `SELECT id, requested_by, interests, suggestions, created_at
     FROM topic_suggestions
     WHERE requested_by = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [userId]
  )

  res.json(
    rows.map((r) => ({
      id:         r.id,
      interests:  r.interests,
      suggestions: r.suggestions,
      createdAt:  r.created_at,
    }))
  )
})

// ─── POST /ai/supervisor-matches — rank supervisors for a topic ───────────────

router.post(
  '/supervisor-matches',
  requireRole('student'),
  geminiLimiter,
  validate(matchSupervisorsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub
    const { topicTitle, keywords } = req.body

    const student = await queryOne<{ name: string; department: string | null }>(
      'SELECT name, department FROM users WHERE id = $1',
      [userId]
    )

    const { matches: finalMatches, aiExplained } = await rankAndExplain(
      topicTitle,
      keywords ?? [],
      student?.department ?? null
    )

    await audit(userId, 'ai.supervisor_match_requested', 'supervisor_match', null, {
      topicTitle,
      keywords,
      aiExplained,
    })

    const adminIds = await getAdminIds()
    notifyMany(
      adminIds,
      'ai.matching_completed',
      'AI supervisor matching completed',
      `${student?.name ?? 'A student'} requested matches for "${topicTitle}" — ${finalMatches.length} supervisor${finalMatches.length !== 1 ? 's' : ''} suggested.`,
      '/admin/groups'
    )

    res.json(finalMatches)
  }
)

// ─── GET /ai/group/:groupId/supervisor-suggestions — ranked picks for admin ───
// Powers the "suggested match" panel on the admin's assign-supervisor UI.
// Derives keywords from the group's latest proposal — if it hasn't submitted
// one yet there's nothing to match against, so this returns an empty list
// rather than guessing. The admin still makes the assignment via the existing
// PATCH /groups/:id/supervisor; this only ranks and explains candidates.

router.get(
  '/group/:groupId/supervisor-suggestions',
  requireRole('admin'),
  geminiLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const groupId = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId

    const group = await queryOne<{ id: string; leader_id: string }>(
      'SELECT id, leader_id FROM groups WHERE id = $1',
      [groupId]
    )
    if (!group) {
      res.status(404).json({ error: 'Group not found' })
      return
    }

    const proposal = await queryOne<{ title: string; abstract: string }>(
      'SELECT title, abstract FROM proposals WHERE group_id = $1 ORDER BY version DESC LIMIT 1',
      [groupId]
    )
    if (!proposal) {
      res.json({ suggestions: [], proposalTitle: null })
      return
    }

    const keywords = extractKeywords(`${proposal.title} ${proposal.abstract}`)
    const leader = await queryOne<{ department: string | null }>(
      'SELECT department FROM users WHERE id = $1',
      [group.leader_id]
    )

    const { matches } = await rankAndExplain(proposal.title, keywords, leader?.department ?? null)

    res.json({ suggestions: matches, proposalTitle: proposal.title })
  }
)

// ─── GET /ai/group/:groupId/review — AI context for panel proposal review ─────
// Returns the group members' AI topic-suggestion history and a supervisor-match
// ranking computed from the group's latest proposal, so the panel can weigh the
// AI recommendations before deciding (admin, panel members, or the supervisor).

router.get('/group/:groupId/review', requireRole('supervisor', 'admin'), async (req: Request, res: Response): Promise<void> => {
  const groupId = Array.isArray(req.params.groupId) ? req.params.groupId[0] : req.params.groupId
  const { sub, role } = req.user!

  const group = await queryOne<{ id: string; supervisor_id: string | null; panel_id: string | null }>(
    'SELECT id, supervisor_id, panel_id FROM groups WHERE id = $1',
    [groupId]
  )
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  if (role !== 'admin' && group.supervisor_id !== sub) {
    const onPanel = group.panel_id
      ? await queryOne('SELECT 1 FROM panel_members WHERE panel_id = $1 AND user_id = $2', [group.panel_id, sub])
      : null
    if (!onPanel) {
      res.status(403).json({ error: 'Access denied' })
      return
    }
  }

  // Topic-suggestion history of the group's members
  const topicHistory = await query<DbTopicSuggestion & { student_name: string }>(
    `SELECT ts.id, ts.requested_by, ts.interests, ts.suggestions, ts.created_at,
            u.name AS student_name
     FROM topic_suggestions ts
     JOIN users u ON u.id = ts.requested_by
     WHERE ts.requested_by IN (SELECT user_id FROM group_members WHERE group_id = $1)
     ORDER BY ts.created_at DESC
     LIMIT 10`,
    [groupId]
  )

  // Supervisor-match ranking from the latest proposal's title keywords
  const proposal = await queryOne<{ title: string; abstract: string }>(
    'SELECT title, abstract FROM proposals WHERE group_id = $1 ORDER BY version DESC LIMIT 1',
    [groupId]
  )

  let matches: unknown[] = []
  if (proposal) {
    const keywords = extractKeywords(`${proposal.title} ${proposal.abstract}`)

    const leader = await queryOne<{ department: string | null }>(
      `SELECT u.department FROM groups g JOIN users u ON u.id = g.leader_id WHERE g.id = $1`,
      [groupId]
    )

    const candidates = await getSupervisorCandidates()
    matches = rankSupervisors(candidates, keywords, leader?.department ?? null)
  }

  res.json({
    topicHistory: topicHistory.map((r) => ({
      id:          r.id,
      studentName: r.student_name,
      interests:   r.interests,
      suggestions: r.suggestions,
      createdAt:   r.created_at,
    })),
    supervisorMatches: matches,
    assignedSupervisorId: group.supervisor_id,
  })
})

export default router
