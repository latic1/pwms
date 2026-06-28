'use client'

import { useState } from 'react'
import { useGroups, useGroup } from '@/hooks/useGroup'
import { useUsers } from '@/hooks/useUsers'
import api from '@/lib/api'

function GroupDetail({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { group, mutate } = useGroup(groupId)
  const { users: supervisors } = useUsers('supervisor')

  const [editingSupervisor, setEditingSupervisor] = useState(false)
  const [newSupervisorId,   setNewSupervisorId]   = useState('')
  const [error,             setError]             = useState('')

  async function handleAssignSupervisor(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api.patch(`/groups/${groupId}/supervisor`, { supervisorId: newSupervisorId || null })
      await mutate()
      setEditingSupervisor(false)
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to assign supervisor.')
    }
  }

  async function handlePromoteLeader(memberId: string) {
    try {
      await api.patch(`/groups/${groupId}/leader`, { leaderId: memberId })
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to reassign leader.')
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from this group?`)) return
    try {
      await api.delete(`/groups/${groupId}/members/${memberId}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to remove member.')
    }
  }

  if (!group) return <div className="text-sm text-gray-400 p-4">Loading...</div>

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Supervisor */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Supervisor</p>
            {editingSupervisor ? (
              <form onSubmit={handleAssignSupervisor} className="flex gap-2 items-center">
                <select
                  value={newSupervisorId}
                  onChange={(e) => setNewSupervisorId(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">— Unassign —</option>
                  {supervisors.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="submit" className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700">
                  Save
                </button>
                <button type="button" onClick={() => setEditingSupervisor(false)} className="text-sm text-gray-500 hover:text-gray-700">
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  {group.supervisor ? group.supervisor.name : <span className="text-red-500">Not assigned</span>}
                </span>
                <button
                  onClick={() => {
                    setNewSupervisorId(group.supervisorId ?? '')
                    setEditingSupervisor(true)
                  }}
                  className="text-xs px-2.5 py-1 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  {group.supervisor ? 'Reassign' : 'Assign'}
                </button>
              </div>
            )}
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          {/* Members */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Members ({group.members.length}/3)
            </p>
            <div className="space-y-2">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {m.name}
                      {m.id === group.leaderId && (
                        <span className="ml-2 text-xs text-yellow-600">(Leader)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.id !== group.leaderId && (
                      <button
                        onClick={() => handlePromoteLeader(m.id)}
                        className="text-xs px-2 py-1 rounded border border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                      >
                        Make Leader
                      </button>
                    )}
                    {m.id !== group.leaderId && (
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        className="text-xs text-red-500 hover:text-red-700 px-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminGroupsPage() {
  const { groups } = useGroups()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
        <p className="text-sm text-gray-500 mt-1">Assign supervisors, manage members, and override group settings</p>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-400">No groups found.</div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between hover:border-gray-400 transition-colors cursor-pointer"
              onClick={() => setSelectedId(g.id)}
            >
              <div>
                <h2 className="font-semibold text-gray-800">{g.name}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {g.memberCount} member{g.memberCount !== 1 ? 's' : ''} ·{' '}
                  {g.supervisorId ? 'Supervisor assigned' : <span className="text-red-500">No supervisor</span>}
                </p>
              </div>
              <span className="text-xs text-gray-400">Manage →</span>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <GroupDetail groupId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
