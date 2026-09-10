/**
 * Deterministic, rule-based supervisor ranking (no AI) — kept explainable and
 * auditable since it feeds a decision (who supervises whom) rather than just
 * brainstorming. Callers still make the final assignment via
 * PATCH /groups/:id/supervisor; this only produces a ranked suggestion list.
 */

export interface SupervisorCandidate {
  id:         string
  name:       string
  email:      string
  department: string | null
  expertise:  string | null
  groupCount: number
}

export interface SupervisorMatch {
  supervisorId:    string
  name:            string
  email:           string
  score:           number
  matchedKeywords: string[]
}

const DEPARTMENT_MATCH_WEIGHT = 2
const KEYWORD_MATCH_WEIGHT    = 1
const LOAD_PENALTY_WEIGHT     = 0.25

function splitKeywords(text: string | null): string[] {
  return (text ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
}

/** Pulls candidate keywords out of free text (a proposal's title + abstract)
 * for matching against a supervisor's comma-separated expertise list. */
export function extractKeywords(text: string, limit = 30): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((w) => w.length > 3)
  )].slice(0, limit)
}

export function rankSupervisors(
  candidates:        SupervisorCandidate[],
  topicKeywords:      string[],
  studentDepartment:  string | null
): SupervisorMatch[] {
  const normalizedTopicKeywords = topicKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean)

  const scored = candidates.map((c) => {
    const supervisorKeywords = splitKeywords(c.expertise)
    const matchedKeywords = normalizedTopicKeywords.filter((k) => supervisorKeywords.includes(k))

    let score = matchedKeywords.length * KEYWORD_MATCH_WEIGHT
    if (studentDepartment && c.department && studentDepartment === c.department) {
      score += DEPARTMENT_MATCH_WEIGHT
    }
    score -= c.groupCount * LOAD_PENALTY_WEIGHT

    return {
      supervisorId:    c.id,
      name:            c.name,
      email:           c.email,
      score:           Math.round(score * 100) / 100,
      matchedKeywords,
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, 5)
}
