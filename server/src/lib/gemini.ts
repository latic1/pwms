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
