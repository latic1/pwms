'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { useGroup } from '@/hooks/useGroup'
import { useDocuments } from '@/hooks/useDocuments'
import { useGrades, useMyGrade } from '@/hooks/useGrades'
import api from '@/lib/api'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const rubricCriteria = [
  { key: 'problem_definition',  label: 'Problem Definition & Objectives',  max: 15 },
  { key: 'literature_review',   label: 'Literature Review',                 max: 15 },
  { key: 'methodology',         label: 'Methodology & Design',              max: 20 },
  { key: 'implementation',      label: 'Implementation & Testing',          max: 25 },
  { key: 'results',             label: 'Results & Discussion',              max: 15 },
  { key: 'report_quality',      label: 'Report Quality & Presentation',     max: 10 },
]

const maxTotal = rubricCriteria.reduce((a, c) => a + c.max, 0)

function getGrade(score: number) {
  if (score >= 70) return { label: 'A', color: 'text-green-600', bg: 'bg-green-50 border-green-200' }
  if (score >= 60) return { label: 'B', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' }
  if (score >= 50) return { label: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' }
  return { label: 'F', color: 'text-red-600', bg: 'bg-red-50 border-red-200' }
}

const docTypeLabels: Record<string, string> = {
  final_report:    'Final Report',
  proposal:        'Proposal',
  progress_report: 'Progress Report',
  supporting:      'Supporting',
}

const docTypeStyles: Record<string, string> = {
  final_report:    'bg-green-100 text-green-700',
  proposal:        'bg-blue-100 text-blue-700',
  progress_report: 'bg-yellow-100 text-yellow-700',
  supporting:      'bg-gray-100 text-gray-600',
}

export default function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params)

  const { group }     = useGroup(groupId)
  const { documents } = useDocuments(groupId)
  const { grades }    = useGrades(groupId)
  const { grade: myGrade, mutate: mutateMyGrade } = useMyGrade(groupId)

  const [scores,   setScores]   = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const supervisorGrade = grades.find((g) => g.graderRole === 'supervisor') ?? null

  const runningTotal = rubricCriteria.reduce((sum, c) => sum + (scores[c.key] ?? 0), 0)
  const grade = getGrade(runningTotal)

  function handleScore(key: string, value: number, max: number) {
    setScores((prev) => ({ ...prev, [key]: Math.min(max, Math.max(0, value)) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post(`/grades/${groupId}`, {
        score:    runningTotal,
        rubric:   scores,
        feedback: feedback.trim() || null,
      })
      await mutateMyGrade()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to submit grade.')
    } finally {
      setSaving(false)
    }
  }

  if (!group) {
    return <div className="text-sm text-gray-400 p-8 text-center">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/examiner/submissions" className="hover:text-gray-700 transition-colors">
          Submissions
        </Link>
        <span>/</span>
        <span className="text-gray-600">{group.name}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {group.members.length} member{group.members.length !== 1 ? 's' : ''} ·{' '}
          {group.supervisor ? `Supervisor: ${group.supervisor.name}` : 'No supervisor assigned'}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="md:col-span-2 space-y-5">

          {/* Documents */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Submitted Files</h2>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
                  <a
                    key={d.id}
                    href={`${API_BASE}${d.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900 truncate">
                        {d.fileName}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${docTypeStyles[d.type] ?? 'bg-gray-100 text-gray-500'}`}>
                      {docTypeLabels[d.type] ?? d.type}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Supervisor's assessment */}
          {supervisorGrade && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Supervisor's Assessment</h2>
              <div className="flex items-center gap-4 mb-3">
                <div className={`rounded-lg border px-4 py-2 ${getGrade(supervisorGrade.score).bg}`}>
                  <p className="text-xs text-gray-500">Score</p>
                  <p className={`text-2xl font-bold ${getGrade(supervisorGrade.score).color}`}>
                    {supervisorGrade.score}/100
                  </p>
                </div>
                <p className={`text-lg font-semibold ${getGrade(supervisorGrade.score).color}`}>
                  Grade {getGrade(supervisorGrade.score).label}
                </p>
              </div>
              {supervisorGrade.feedback && (
                <p className="text-sm text-gray-600 italic">"{supervisorGrade.feedback}"</p>
              )}
            </div>
          )}

          {/* Grading form */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">Your Examination Grade</h2>
            <p className="text-sm text-gray-500 mb-5">
              Score each criterion independently of the supervisor's assessment.
            </p>

            {myGrade ? (
              <div className="space-y-4">
                <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${getGrade(myGrade.score).bg} ${getGrade(myGrade.score).color}`}>
                  Grade submitted successfully.
                </div>
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl border px-6 py-4 text-center ${getGrade(myGrade.score).bg}`}>
                    <p className={`text-4xl font-bold ${getGrade(myGrade.score).color}`}>{myGrade.score}</p>
                    <p className="text-sm text-gray-500 mt-0.5">/ {maxTotal}</p>
                  </div>
                  <div>
                    <p className={`text-3xl font-bold ${getGrade(myGrade.score).color}`}>
                      Grade {getGrade(myGrade.score).label}
                    </p>
                    {myGrade.feedback && (
                      <p className="text-sm text-gray-500 mt-1 max-w-xs">"{myGrade.feedback}"</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
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
                        className="flex-1 accent-orange-500"
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
                        className="bg-orange-400 h-1 rounded-full transition-all"
                        style={{ width: `${((scores[c.key] ?? 0) / c.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

                {/* Running total */}
                <div className={`rounded-lg border px-4 py-3 flex items-center justify-between ${grade.bg}`}>
                  <span className="text-sm font-medium text-gray-700">Total Score</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${grade.color}`}>{runningTotal}</span>
                    <span className="text-sm text-gray-400">/ {maxTotal}</span>
                    <span className={`text-sm font-semibold ml-1 ${grade.color}`}>
                      (Grade {grade.label})
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Examiner Feedback</label>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={4}
                    placeholder="Write your examination feedback..."
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Submitting...' : 'Submit Examination Grade'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right column — members */}
        <div>
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-3">Group Members</h2>
            <ul className="space-y-3">
              {group.members.map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center shrink-0">
                    {m.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {m.name}
                      {m.id === group.leaderId && (
                        <span className="ml-1 text-xs text-yellow-600">(L)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
