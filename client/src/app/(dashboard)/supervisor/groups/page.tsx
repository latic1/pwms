'use client'

import { useState } from 'react'
import { useGroups, useGroup } from '@/hooks/useGroup'
import { useProposal } from '@/hooks/useProposal'
import { useTasks } from '@/hooks/useTasks'
import { useDocuments } from '@/hooks/useDocuments'
import { DocumentCommentThread } from '@/components/documents/DocumentCommentThread'
import api, { API_BASE } from '@/lib/api'
import type { Proposal, Task, GroupMember } from '@/types'

const proposalStatusStyles: Record<Proposal['status'], string> = {
  pending:           'bg-yellow-100 text-yellow-700',
  approved:          'bg-green-100 text-green-700',
  rejected:          'bg-red-100 text-red-700',
  changes_requested: 'bg-amber-100 text-amber-700',
}

const taskStatusStyles: Record<string, string> = {
  pending:           'bg-gray-100 text-gray-600',
  in_progress:       'bg-blue-100 text-blue-700',
  under_review:      'bg-yellow-100 text-yellow-700',
  changes_requested: 'bg-amber-100 text-amber-700',
  done:              'bg-green-100 text-green-700',
}

// ─── Task review (accept / decline a submission) ───────────────────────────────

function TaskItem({ groupId, task, members, onChanged }: {
  groupId: string
  task: Task
  members: GroupMember[]
  onChanged: () => void
}) {
  const [declining, setDeclining] = useState(false)
  const [comment,   setComment]   = useState('')
  const [busy,      setBusy]      = useState(false)
  const [error,     setError]     = useState('')

  const assignee = members.find((m) => m.id === task.assigneeId)

  async function decide(status: 'done' | 'changes_requested') {
    if (status === 'changes_requested' && !comment.trim()) {
      setError('A comment is required when declining.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.patch(`/tasks/${groupId}/${task.id}`, {
        status,
        ...(status === 'changes_requested' && { supervisorComment: comment.trim() }),
      })
      setComment('')
      setDeclining(false)
      onChanged()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update task.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-gray-50 rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between text-sm gap-3">
        <div className="min-w-0">
          <p className="text-gray-700 truncate">{task.title}</p>
          {task.dueDate && (
            <p className="text-xs text-gray-400">Due {new Date(task.dueDate).toLocaleDateString()}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {assignee && <span className="text-xs text-gray-400">{assignee.name.split(' ')[0]}</span>}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusStyles[task.status]}`}>
            {task.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {task.status === 'changes_requested' && task.supervisorComment && (
        <p className="text-xs text-amber-700 mt-1.5 italic">Feedback given: &ldquo;{task.supervisorComment}&rdquo;</p>
      )}

      {task.status === 'under_review' && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          {declining ? (
            <div className="space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Reason for declining — what should they fix? (required)"
                className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => decide('changes_requested')}
                  disabled={busy}
                  className="text-xs px-2.5 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {busy ? '...' : 'Confirm decline'}
                </button>
                <button
                  onClick={() => { setDeclining(false); setError('') }}
                  className="text-xs px-2.5 py-1 rounded-md border text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => decide('done')}
                disabled={busy}
                className="text-xs px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => setDeclining(true)}
                className="text-xs px-2.5 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create a task ──────────────────────────────────────────────────────────────

function NewTaskForm({ groupId, members, onCreated, onCancel }: {
  groupId: string
  members: GroupMember[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId,  setAssigneeId]  = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [busy,        setBusy]        = useState(false)
  const [error,       setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/tasks/${groupId}`, {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
      })
      onCreated()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to create task.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg border p-3 space-y-2 mb-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
        placeholder="e.g. Submit Chapter One"
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Details (optional)"
        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-xs px-2.5 py-1 text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? 'Adding...' : 'Add task'}
        </button>
      </div>
    </form>
  )
}

function GroupDetail({ groupId }: { groupId: string }) {
  const { group }     = useGroup(groupId)
  const { proposal, mutate: mutateProposal } = useProposal(groupId)
  const { tasks, mutate: mutateTasks } = useTasks(groupId)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const { documents } = useDocuments(groupId)

  const [reviewComment, setReviewComment] = useState('')
  const [reviewBusy,    setReviewBusy]    = useState(false)
  const [reviewError,   setReviewError]   = useState('')

  async function handleReview(status: 'approved' | 'rejected' | 'changes_requested') {
    if (status !== 'approved' && !reviewComment.trim()) {
      setReviewError('A comment is required when rejecting or requesting changes.')
      return
    }
    setReviewError(''); setReviewBusy(true)
    try {
      await api.patch(`/proposals/${groupId}/review`, {
        status,
        supervisorComment: reviewComment.trim() || undefined,
      })
      await mutateProposal()
      setReviewComment('')
    } catch (err: any) {
      setReviewError(err?.response?.data?.error ?? 'Failed to submit review.')
    } finally {
      setReviewBusy(false)
    }
  }

  if (!group) return <div className="text-sm text-gray-400 p-4">Loading...</div>

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-3">{group.name} — Detail</h2>

      {/* Members */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Members</h3>
        <div className="flex flex-wrap gap-3">
          {group.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
                {m.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">
                  {m.name}
                  {m.id === group.leaderId && (
                    <span className="ml-1 text-yellow-600">(Leader)</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{m.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Proposal */}
      {proposal && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Proposal</h3>
          <div className="rounded-lg bg-gray-50 border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">{proposal.title}</p>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${proposalStatusStyles[proposal.status]}`}>
                {proposal.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{proposal.abstract}</p>
            {proposal.supervisorComment && (
              <p className="text-xs text-gray-500 italic">Feedback given: &ldquo;{proposal.supervisorComment}&rdquo;</p>
            )}
            <div className="flex items-center gap-3">
              <a
                href={`${API_BASE}${proposal.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Download PDF
              </a>
            </div>

            {/* Accept / decline controls */}
            {proposal.status === 'pending' && (
              <div className="border-t pt-3 space-y-2">
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={2}
                  placeholder="Feedback for the group (required for reject / request changes)..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
                {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleReview('approved')}
                    disabled={reviewBusy}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview('changes_requested')}
                    disabled={reviewBusy}
                    className="px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    onClick={() => handleReview('rejected')}
                    disabled={reviewBusy}
                    className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Tasks</h3>
          {!showTaskForm && (
            <button
              onClick={() => setShowTaskForm(true)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              + Add task
            </button>
          )}
        </div>
        {showTaskForm && (
          <NewTaskForm
            groupId={groupId}
            members={group.members}
            onCreated={() => { mutateTasks(); setShowTaskForm(false) }}
            onCancel={() => setShowTaskForm(false)}
          />
        )}
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-400">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <TaskItem
                key={t.id}
                groupId={groupId}
                task={t}
                members={group.members}
                onChanged={() => mutateTasks()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="bg-gray-50 rounded-lg px-3 py-2 border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 truncate">{d.fileName}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">{new Date(d.uploadedAt).toLocaleDateString()}</span>
                    <a
                      href={`${API_BASE}${d.fileUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Download
                    </a>
                  </div>
                </div>
                <DocumentCommentThread groupId={groupId} docId={d.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SupervisorGroupsPage() {
  const { groups } = useGroups()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [exporting,  setExporting]  = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/exports/my-students', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-students.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export student list.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor all your assigned project groups</p>
        </div>
        {groups.length > 0 && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export students to Excel'}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No groups assigned to you yet.</div>
      ) : (
        <div className="grid gap-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className={`bg-white rounded-xl border shadow-sm p-5 cursor-pointer transition-all hover:border-gray-400 ${
                selectedId === g.id ? 'border-gray-900 ring-1 ring-gray-900' : ''
              }`}
              onClick={() => setSelectedId(selectedId === g.id ? null : g.id)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-800">{g.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {g.memberCount} member{g.memberCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {selectedId === g.id ? '▲' : '▼'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && <GroupDetail key={selectedId} groupId={selectedId} />}
    </div>
  )
}
