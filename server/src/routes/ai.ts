import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { query, queryOne } from '../db'
import { authenticate, requireRole } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import { suggestTopicsSchema, matchSupervisorsSchema } from '../lib/schemas'
import { suggestTopics } from '../lib/gemini'
import { rankSupervisors, SupervisorCandidate } from '../lib/supervisorMatch'
import { audit } from '../lib/auditLog'

const router = Router()
router.use(authenticate)

// Protects the free Gemini quota — this is the only route that calls out to it.
const topicsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many topic suggestion requests, please try again later.' },
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

// ─── POST /ai/topics — generate topic suggestions ─────────────────────────────

router.post(
  '/topics',
  requireRole('student'),
  topicsLimiter,
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
  validate(matchSupervisorsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.sub
    const { topicTitle, keywords } = req.body

    const student = await queryOne<{ department: string | null }>(
      'SELECT department FROM users WHERE id = $1',
      [userId]
    )

    const candidates = await query<DbSupervisorCandidate>(
      `SELECT u.id, u.name, u.email, u.department, u.expertise, COUNT(g.id) AS group_count
       FROM users u
       LEFT JOIN groups g ON g.supervisor_id = u.id
       WHERE u.role = 'supervisor'
       GROUP BY u.id`
    )

    const matchInput: SupervisorCandidate[] = candidates.map((c) => ({
      id:         c.id,
      name:       c.name,
      email:      c.email,
      department: c.department,
      expertise:  c.expertise,
      groupCount: Number(c.group_count),
    }))

    const matches = rankSupervisors(matchInput, keywords ?? [], student?.department ?? null)

    await audit(userId, 'ai.supervisor_match_requested', 'supervisor_match', null, {
      topicTitle,
      keywords,
    })

    res.json(matches)
  }
)

export default router
