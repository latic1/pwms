'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useGroups, useGroup } from '@/hooks/useGroup'
import { useProposal } from '@/hooks/useProposal'
import { useTasks } from '@/hooks/useTasks'
import { useDocuments } from '@/hooks/useDocuments'
import { API_BASE } from '@/lib/api'
import type { Proposal } from '@/types'

const proposalStatusStyles: Record<Proposal['status'], string> = {
  pending:           'bg-yellow-100 text-yellow-700',
  approved:          'bg-green-100 text-green-700',
  rejected:          'bg-red-100 text-red-700',
  changes_requested: 'bg-amber-100 text-amber-700',
}

const taskStatusStyles: Record<string, string> = {
  pending:      'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  done:         'bg-green-100 text-green-700',
}

function GroupDetail({ groupId }: { groupId: string }) {
  const { group }     = useGroup(groupId)
  const { proposal }  = useProposal(groupId)
  const { tasks }     = useTasks(groupId)
  const { documents } = useDocuments(groupId)
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
            <p className="text-xs text-gray-500 line-clamp-2">{proposal.abstract}</p>
            <div className="flex items-center gap-3">
              <a
                href={`${API_BASE}${proposal.fileUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline"
              >
                Download PDF
              </a>
              {proposal.status === 'pending' && (
                <span className="text-xs text-gray-400">
                  Awaiting examination panel review
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Tasks</h3>
          <div className="space-y-2">
            {tasks.map((t) => {
              const assignee = group.members.find((m) => m.id === t.assigneeId)
              return (
                <div key={t.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 border">
                  <span className="text-gray-700 truncate mr-3">{t.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {assignee && <span className="text-xs text-gray-400">{assignee.name.split(' ')[0]}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${taskStatusStyles[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Documents</h3>
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 border">
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor all your assigned project groups</p>
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

      {selectedId && <GroupDetail groupId={selectedId} />}
    </div>
  )
}
