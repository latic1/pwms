'use client'

import { useState } from 'react'
import { useGroups } from '@/hooks/useGroup'
import { useGrades, useMyGrade } from '@/hooks/useGrades'
import api from '@/lib/api'
import type { GroupSummary } from '@/types'

const rubricCriteria = [
  { key: 'problem_statement', label: 'Problem Statement',      max: 20 },
  { key: 'methodology',       label: 'Methodology',            max: 25 },
  { key: 'implementation',    label: 'Implementation',         max: 25 },
  { key: 'results',           label: 'Results & Evaluation',   max: 20 },
  { key: 'presentation',      label: 'Report & Presentation',  max: 10 },
]

const MAX_TOTAL = rubricCriteria.reduce((a, c) => a + c.max, 0)

type RubricScores = Record<string, number>

function getGrade(score: number) {
  if (score >= 70) return { label: 'A', color: 'text-green-600' }
  if (score >= 60) return { label: 'B', color: 'text-blue-600' }
  if (score >= 50) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'F', color: 'text-red-600' }
}

function GradeForm({ group }: { group: GroupSummary }) {
  const { grade: existingGrade, mutate } = useMyGrade(group.id)

  const [scores,    setScores]    = useState<RubricScores>({})
  const [feedback,  setFeedback]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,     setError]     = useState('')
  const [submitted, setSubmitted]  = useState(false)

  const total = Object.values(scores).reduce((a, b) => a + b, 0)

  function handleScore(key: string, value: number, max: number) {
    setScores((prev) => ({ ...prev, [key]: Math.min(max, Math.max(0, value)) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.post(`/grades/${group.id}`, {
        score: total,
        rubric: scores,
        feedback: feedback || undefined,
      })
      await mutate()
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to submit grade.')
    } finally {
      setSubmitting(false)
    }
  }

  if (existingGrade) {
    const g = getGrade(existingGrade.score)
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Grade already submitted.
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${g.color}`}>{existingGrade.score}</div>
          <div>
            <p className="text-sm text-gray-500">out of {MAX_TOTAL}</p>
            <p className={`text-lg font-semibold ${g.color}`}>Grade {g.label}</p>
          </div>
        </div>
        {existingGrade.feedback && (
          <p className="text-sm text-gray-600 italic">"{existingGrade.feedback}"</p>
        )}
      </div>
    )
  }

  if (submitted) {
    const g = getGrade(total)
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Grade submitted successfully. Total: {total}/{MAX_TOTAL}
        </div>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${g.color}`}>{total}</div>
          <div>
            <p className="text-sm text-gray-500">out of {MAX_TOTAL}</p>
            <p className={`text-lg font-semibold ${g.color}`}>Grade {g.label}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {rubricCriteria.map((c) => (
        <div key={c.key}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">{c.label}</label>
            <span className="text-xs text-gray-400">Max: {c.max}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={c.max}
              value={scores[c.key] ?? 0}
              onChange={(e) => handleScore(c.key, Number(e.target.value), c.max)}
              className="flex-1 accent-gray-900"
            />
            <input
              type="number"
              min={0}
              max={c.max}
              value={scores[c.key] ?? 0}
              onChange={(e) => handleScore(c.key, Number(e.target.value), c.max)}
              className="w-14 text-center rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <span className="text-xs text-gray-400 w-10 text-right">/{c.max}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1 mt-1">
            <div
              className="bg-gray-700 h-1 rounded-full transition-all"
              style={{ width: `${((scores[c.key] ?? 0) / c.max) * 100}%` }}
            />
          </div>
        </div>
      ))}

      <div className="rounded-lg bg-gray-50 border px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Total Score</span>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">{total}</span>
          <span className="text-sm text-gray-400">/ {MAX_TOTAL}</span>
          <span className={`text-sm font-semibold ml-1 ${getGrade(total).color}`}>
            ({getGrade(total).label})
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Overall Feedback</label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="Write overall feedback for the group..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Grade'}
        </button>
      </div>
    </form>
  )
}

export default function GradingPage() {
  const { groups } = useGroups()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedGroup = groups.find((g) => g.id === selectedId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Grading</h1>
        <p className="text-sm text-gray-500 mt-1">Evaluate and grade your assigned groups</p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No groups assigned yet.</div>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div
              key={g.id}
              onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
              className={`bg-white rounded-xl border shadow-sm p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-gray-400 transition-colors ${
                selectedId === g.id ? 'border-gray-900 ring-1 ring-gray-900' : ''
              }`}
            >
              <div>
                <p className="font-medium text-gray-800">{g.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{g.memberCount} members</p>
              </div>
              <span className="text-xs text-gray-400">{selectedId === g.id ? '▲' : '▼'}</span>
            </div>
          ))}
        </div>
      )}

      {selectedGroup && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-1">Grade — {selectedGroup.name}</h2>
          <p className="text-sm text-gray-500 mb-5">Score each criterion out of its maximum marks.</p>
          <GradeForm group={selectedGroup} />
        </div>
      )}
    </div>
  )
}
