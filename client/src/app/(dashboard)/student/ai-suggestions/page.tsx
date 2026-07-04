'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  useTopicSuggestionHistory,
  generateTopicSuggestions,
  matchSupervisors,
} from '@/hooks/useAiSuggestions'
import type { TopicSuggestion, SupervisorMatch } from '@/types'

export default function AiSuggestionsPage() {
  const { user } = useAuth()
  const { history, mutate } = useTopicSuggestionHistory()

  const [interests, setInterests]   = useState('')
  const [topics, setTopics]         = useState<TopicSuggestion[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError]           = useState('')

  const [matches, setMatches]         = useState<Record<number, SupervisorMatch[]>>({})
  const [matching, setMatching]       = useState<Record<number, boolean>>({})

  if (user && user.role !== 'student') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 text-center">
          This page is only available to students.
        </div>
      </div>
    )
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    const parsed = interests.split(',').map((s) => s.trim()).filter(Boolean)
    if (parsed.length === 0) return

    setError('')
    setGenerating(true)
    setMatches({})
    try {
      const suggestions = await generateTopicSuggestions(parsed)
      setTopics(suggestions)
      await mutate()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to generate suggestions.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleMatch(index: number, topic: TopicSuggestion) {
    setMatching((m) => ({ ...m, [index]: true }))
    try {
      const ranked = await matchSupervisors(topic.title, topic.keywords)
      setMatches((m) => ({ ...m, [index]: ranked }))
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to match supervisors.')
    } finally {
      setMatching((m) => ({ ...m, [index]: false }))
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Topic Suggestions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe your interests and get AI-suggested final-year project topics, plus matching supervisors.
        </p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your interests (comma-separated)
            </label>
            <input
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="e.g. machine learning, mobile apps, cybersecurity"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={generating || !interests.trim()}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Suggestions'}
          </button>
        </form>
      </div>

      {topics.map((topic, i) => (
        <div key={i} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-800">{topic.title}</h2>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{topic.description}</p>
            {topic.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {topic.keywords.map((k) => (
                  <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleMatch(i, topic)}
            disabled={matching[i]}
            className="text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {matching[i] ? 'Finding supervisors...' : 'Find Matching Supervisors'}
          </button>

          {matches[i] && (
            <div className="space-y-2 pt-2 border-t">
              {matches[i].length === 0 ? (
                <p className="text-sm text-gray-500">No supervisors found.</p>
              ) : (
                matches[i].map((m) => (
                  <div key={m.supervisorId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <div>
                      <p className="font-medium text-gray-700">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                      {m.matchedKeywords.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Matched: {m.matchedKeywords.join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium shrink-0">
                      score {m.score}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {history.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Past Suggestions</h2>
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h.id} className="text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-gray-500">{new Date(h.createdAt).toLocaleDateString()}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {h.suggestions.length} topics
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">Interests: {h.interests}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
