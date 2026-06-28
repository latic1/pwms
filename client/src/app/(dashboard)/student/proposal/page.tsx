'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useProposal, useProposalHistory } from '@/hooks/useProposal'
import api from '@/lib/api'
import { API_BASE } from '@/lib/api'
import type { Proposal } from '@/types'

const statusStyles: Record<Proposal['status'], string> = {
  pending:  'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const statusLabels: Record<Proposal['status'], string> = {
  pending:  'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
}

export default function ProposalPage() {
  const { user }  = useAuth()
  const { group } = useMyGroup()
  const { proposal, mutate } = useProposal(group?.id ?? null)
  const { history }          = useProposalHistory(group?.id ?? null)

  const isLeader = group?.leaderId === user?.id

  const [showForm, setShowForm]   = useState(false)
  const [title,    setTitle]      = useState('')
  const [abstract, setAbstract]   = useState('')
  const [file,     setFile]       = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error,    setError]      = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!group || !file) return
    setError('')
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('title', title.trim())
      form.append('abstract', abstract.trim())
      form.append('file', file)
      await api.post(`/proposals/${group.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await mutate()
      setShowForm(false)
      setTitle('')
      setAbstract('')
      setFile(null)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Proposal</h1>
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 text-center">
          You must be in a group before submitting a proposal.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proposal</h1>
        <p className="text-sm text-gray-500 mt-1">Submit and track your group's project proposal</p>
      </div>

      {/* Current proposal */}
      {proposal ? (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 truncate">{proposal.title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Last submitted {new Date(proposal.submittedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                v{proposal.version}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[proposal.status]}`}>
                {statusLabels[proposal.status]}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">{proposal.abstract}</p>

          {proposal.supervisorComment && (
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Supervisor Feedback</p>
              <p className="text-sm text-blue-800">{proposal.supervisorComment}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <a
              href={`${API_BASE}${proposal.fileUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-700 underline underline-offset-2 hover:text-gray-900"
            >
              View submitted file
            </a>
            {isLeader && proposal.status !== 'approved' && (
              <button
                onClick={() => {
                  setTitle(proposal.title)
                  setAbstract(proposal.abstract)
                  setShowForm(!showForm)
                }}
                className="ml-auto text-sm px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              >
                {showForm ? 'Cancel' : proposal.status === 'rejected' ? 'Resubmit' : 'Edit & Resubmit'}
              </button>
            )}
          </div>
        </div>
      ) : (
        isLeader && (
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="font-semibold text-gray-800 mb-1">No Proposal Yet</h2>
            <p className="text-sm text-gray-500 mb-4">Submit your first proposal to get started.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700"
            >
              + Submit Proposal
            </button>
          </div>
        )
      )}

      {/* Submission form */}
      {showForm && isLeader && (
        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">
            {proposal ? `Submit Revision — v${proposal.version + 1}` : 'Initial Submission'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abstract</label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                rows={5}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload Proposal (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="proposal-file"
                  accept=".pdf"
                  required
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="proposal-file" className="cursor-pointer">
                  {file ? (
                    <p className="text-sm text-gray-700 font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">Click to select a PDF file</p>
                      <p className="text-xs text-gray-400 mt-1">Max 20MB</p>
                    </>
                  )}
                </label>
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !file}
                className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isLeader && !proposal && (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
          Only the group leader can submit the proposal.
        </div>
      )}

      {/* Version History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Version History</h2>
          <div className="space-y-3">
            {history.map((v) => (
              <div key={v.id} className="flex items-start gap-4 text-sm">
                <span className="shrink-0 mt-0.5 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  v{v.version}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-500">
                      {new Date(v.submittedAt).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[v.status]}`}>
                      {statusLabels[v.status]}
                    </span>
                  </div>
                  {v.supervisorComment && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{v.supervisorComment}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
