/**
 * Gemini client for AI-assisted final-year-project topic suggestions.
 * Uses the free-tier Generative Language API. Never throws — callers get an
 * empty array on any failure (missing key, network error, bad response shape).
 */

const API_KEY = process.env.GEMINI_API_KEY ?? ''
const MODEL   = process.env.GEMINI_MODEL   ?? 'gemini-2.5-flash-lite'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface TopicSuggestion {
  title:       string
  description: string
  keywords:    string[]
}

/**
 * Ask Gemini to brainstorm final-year-project topics for a student.
 * @param interests   Free-text interest keywords the student supplied
 * @param department  Student's department, if known (improves relevance)
 */
export async function suggestTopics(
  interests:  string[],
  department: string | null
): Promise<TopicSuggestion[]> {
  if (!API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not set — skipping topic suggestion')
    return []
  }

  const prompt = [
    'You are helping a final-year university student brainstorm project topics.',
    department ? `Student department: ${department}.` : '',
    `Student interests: ${interests.join(', ')}.`,
    'Suggest exactly 10 distinct final-year project topics suited to these interests.',
    'Respond with ONLY a JSON array (no markdown, no prose) of objects shaped like:',
    '[{"title": string, "description": string (1-2 sentences), "keywords": string[] (3-6 lowercase keywords)}]',
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[Gemini] Request failed ${res.status}:`, body)
      return []
    }

    const data = await res.json() as any
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      console.error('[Gemini] No text in response:', JSON.stringify(data))
      return []
    }

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((t) => t && typeof t.title === 'string' && typeof t.description === 'string')
      .map((t) => ({
        title:       t.title,
        description: t.description,
        keywords:    Array.isArray(t.keywords) ? t.keywords.filter((k: unknown) => typeof k === 'string') : [],
      }))
  } catch (err) {
    console.error('[Gemini] Failed to generate/parse topic suggestions:', err)
    return []
  }
}

export interface SupervisorMatchCandidate {
  supervisorId:    string
  name:            string
  expertise:       string | null
  score:           number
  matchedKeywords: string[]
}

export interface SupervisorMatchExplanation {
  supervisorId: string
  reason:       string
}

/**
 * Re-rank a rule-based supervisor shortlist and write a one-line "why" for
 * each candidate, using only the facts already computed by rankSupervisors()
 * (no invented claims about a supervisor). This is layered on top of the
 * deterministic scoring, not a replacement for it — if this call fails or
 * returns something malformed, callers should fall back to the original
 * rule-based order with no explanation, never block on this.
 */
export async function explainSupervisorMatches(
  topicTitle: string,
  keywords:   string[],
  candidates: SupervisorMatchCandidate[]
): Promise<SupervisorMatchExplanation[]> {
  if (!API_KEY || candidates.length === 0) return []

  const prompt = [
    'A student is looking for a final-year-project supervisor.',
    `Proposed topic: "${topicTitle}".`,
    keywords.length ? `Topic keywords: ${keywords.join(', ')}.` : '',
    'Below is a shortlist of candidate supervisors, already ranked by a rule-based system (keyword overlap with their listed expertise, department match, and current supervision workload). Do not invent facts about any supervisor beyond what is given here.',
    JSON.stringify(candidates.map((c) => ({
      id:               c.supervisorId,
      name:             c.name,
      expertise:        c.expertise ?? 'not specified',
      ruleBasedScore:   c.score,
      matchedKeywords:  c.matchedKeywords,
    }))),
    'Order these candidates from best to worst fit for the topic, and write one short sentence (max 20 words) per candidate explaining the fit, grounded only in the fields given.',
    'Respond with ONLY a JSON array (no markdown, no prose), same length as the input, ordered best-fit first, shaped like:',
    '[{"id": string, "reason": string}]',
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[Gemini] Supervisor-match explanation request failed ${res.status}:`, body)
      return []
    }

    const data = await res.json() as any
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return []

    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []

    const validIds = new Set(candidates.map((c) => c.supervisorId))
    return parsed
      .filter((e) => e && typeof e.id === 'string' && typeof e.reason === 'string' && validIds.has(e.id))
      .map((e) => ({ supervisorId: e.id, reason: e.reason }))
  } catch (err) {
    console.error('[Gemini] Failed to generate/parse supervisor-match explanations:', err)
    return []
  }
}
