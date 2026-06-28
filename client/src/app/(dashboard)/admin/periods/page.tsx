'use client'

import { useState } from 'react'
import { usePeriods } from '@/hooks/usePeriods'
import api from '@/lib/api'
import type { AcademicPeriod } from '@/types'

function isDeadlinePassed(date: string) {
  return new Date(date) < new Date()
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString()
}

export default function PeriodsPage() {
  const { periods, mutate } = usePeriods()

  const [showCreate, setShowCreate]  = useState(false)
  const [editingId,  setEditingId]   = useState<string | null>(null)
  const [error,      setError]       = useState('')
  const [saving,     setSaving]      = useState(false)
  const [success,    setSuccess]     = useState('')

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '', groupDeadline: '', proposalDeadline: '', submissionDeadline: '',
  })

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<AcademicPeriod>>({})

  function startEdit(p: AcademicPeriod) {
    setEditingId(p.id)
    setEditForm({
      name:               p.name,
      groupDeadline:      p.groupDeadline.slice(0, 10),
      proposalDeadline:   p.proposalDeadline.slice(0, 10),
      submissionDeadline: p.submissionDeadline.slice(0, 10),
    })
    setError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/periods', createForm)
      await mutate()
      setShowCreate(false)
      setCreateForm({ name: '', groupDeadline: '', proposalDeadline: '', submissionDeadline: '' })
      setSuccess('Period created.')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create period.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setError('')
    setSaving(true)
    try {
      await api.patch(`/periods/${editingId}`, editForm)
      await mutate()
      setEditingId(null)
      setSuccess('Period updated.')
      setTimeout(() => setSuccess(''), 2500)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update period.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleGrades(period: AcademicPeriod) {
    try {
      await api.patch(`/periods/${period.id}/release-grades`, {
        gradesReleased: !period.gradesReleased,
      })
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to toggle grades.')
    }
  }

  async function handleDelete(period: AcademicPeriod) {
    if (!confirm(`Delete period "${period.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/periods/${period.id}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to delete period.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Academic Periods</h1>
          <p className="text-sm text-gray-500 mt-1">Configure deadlines and grade release</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setError('') }}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700"
        >
          {showCreate ? 'Cancel' : '+ New Period'}
        </button>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">New Academic Period</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Name</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                placeholder="e.g. Academic Year 2025/2026"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['groupDeadline', 'proposalDeadline', 'submissionDeadline'] as const).map((k) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {k === 'groupDeadline' ? 'Group Formation' : k === 'proposalDeadline' ? 'Proposal' : 'Final Submission'}
                  </label>
                  <input
                    type="date"
                    value={createForm[k]}
                    onChange={(e) => setCreateForm({ ...createForm, [k]: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Period'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Periods list */}
      {periods.length === 0 && !showCreate ? (
        <div className="text-center py-12 text-sm text-gray-400">No academic periods yet.</div>
      ) : (
        <div className="space-y-4">
          {periods.map((p, i) => (
            <div key={p.id} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  {i === 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium mr-2">
                      Current
                    </span>
                  )}
                  <h2 className="text-base font-semibold text-gray-800 mt-1">{p.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  {editingId !== p.id && (
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs px-3 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(p)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingId === p.id ? (
                <form onSubmit={handleUpdate} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(['groupDeadline', 'proposalDeadline', 'submissionDeadline'] as const).map((k) => (
                      <div key={k}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {k === 'groupDeadline' ? 'Group' : k === 'proposalDeadline' ? 'Proposal' : 'Final'}
                        </label>
                        <input
                          type="date"
                          value={(editForm[k] as string) ?? ''}
                          onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                      </div>
                    ))}
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-md border text-sm text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Group Formation', date: p.groupDeadline },
                    { label: 'Proposal Deadline', date: p.proposalDeadline },
                    { label: 'Final Submission', date: p.submissionDeadline },
                  ].map((d) => (
                    <div key={d.label} className="rounded-lg bg-gray-50 border p-3">
                      <p className="text-xs text-gray-500 mb-1">{d.label}</p>
                      <p className={`text-sm font-semibold ${isDeadlinePassed(d.date) ? 'text-red-600' : 'text-gray-800'}`}>
                        {fmt(d.date)}
                      </p>
                      {isDeadlinePassed(d.date) && <p className="text-xs text-red-400 mt-0.5">Passed</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Grade release toggle */}
              <div className="border-t pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">Release Grades to Students</p>
                  <p className="text-xs text-gray-400 mt-0.5">When enabled, students can view their final grades.</p>
                </div>
                <button
                  onClick={() => handleToggleGrades(p)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    p.gradesReleased ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      p.gradesReleased ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className={`text-xs font-medium ${p.gradesReleased ? 'text-green-600' : 'text-gray-400'}`}>
                {p.gradesReleased ? 'Grades are visible to students' : 'Grades are hidden from students'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
