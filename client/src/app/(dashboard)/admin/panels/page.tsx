'use client'

import { useState } from 'react'
import { usePanels } from '@/hooks/usePanels'
import { useUsers } from '@/hooks/useUsers'
import { useGroups } from '@/hooks/useGroup'
import api from '@/lib/api'
import type { Panel } from '@/types'

function PanelDetail({ panel, onClose, onChanged }: { panel: Panel; onClose: () => void; onChanged: () => void }) {
  const { users: supervisors } = useUsers('supervisor', { activeOnly: true })
  const { groups, mutate: mutateGroups } = useGroups()

  const [name,      setName]      = useState(panel.name)
  const [memberIds, setMemberIds] = useState<string[]>(panel.members.map((m) => m.id))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  function toggleMember(id: string) {
    setMemberIds((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  async function handleSave() {
    setError(''); setSaving(true)
    try {
      await api.patch(`/panels/${panel.id}`, { name: name.trim(), memberIds })
      onChanged()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save panel.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignGroup(groupId: string, assign: boolean) {
    setError('')
    try {
      await api.patch(`/groups/${groupId}/panel`, { panelId: assign ? panel.id : null })
      await mutateGroups()
      onChanged()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to update group assignment.')
    }
  }

  const assignedIds = new Set(panel.groups.map((g) => g.id))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Manage Panel</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Panel name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Members */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Members ({memberIds.length}) — supervisors only
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
              {supervisors.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">No supervisors registered yet.</p>
              ) : supervisors.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(s.id)}
                    onChange={() => toggleMember(s.id)}
                    className="accent-indigo-600"
                  />
                  <span className="text-sm text-gray-700">{s.name}</span>
                  <span className="text-xs text-gray-400 truncate">{s.email}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Group assignment */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assigned groups</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-lg p-2">
              {groups.length === 0 ? (
                <p className="text-xs text-gray-400 p-2">No student groups yet.</p>
              ) : groups.map((g) => {
                const assignedHere      = assignedIds.has(g.id)
                const assignedElsewhere = !assignedHere && g.panelId != null
                return (
                  <div key={g.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-700 truncate">{g.name}</p>
                      {assignedElsewhere && <p className="text-[11px] text-amber-600">Assigned to another panel</p>}
                    </div>
                    <button
                      onClick={() => handleAssignGroup(g.id, !assignedHere)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        assignedHere
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {assignedHere ? 'Unassign' : assignedElsewhere ? 'Move here' : 'Assign'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Close</button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PanelsPage() {
  const { panels, mutate } = usePanels()

  const [showCreate, setShowCreate] = useState(false)
  const [newName,    setNewName]    = useState('')
  const [creating,   setCreating]   = useState(false)
  const [createErr,  setCreateErr]  = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = panels.find((pl) => pl.id === selectedId) ?? null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateErr(''); setCreating(true)
    try {
      await api.post('/panels', { name: newName.trim() })
      await mutate()
      setNewName(''); setShowCreate(false)
    } catch (err: any) {
      setCreateErr(err?.response?.data?.error ?? 'Failed to create panel.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(panel: Panel) {
    if (!confirm(`Delete panel "${panel.name}"? Its assigned groups will become unassigned.`)) return
    try {
      await api.delete(`/panels/${panel.id}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to delete panel.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Examination Panels</h1>
          <p className="text-sm text-gray-500 mt-1">
            Panels are groups of supervisors that examine and grade student projects
          </p>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + New panel
          </button>
        )}
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            placeholder="Panel name — e.g. Panel A"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </button>
          {createErr && <p className="text-sm text-red-600">{createErr}</p>}
        </form>
      )}

      {panels.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          No panels yet. Create one and add supervisors to it.
        </div>
      ) : (
        <div className="space-y-3">
          {panels.map((panel) => (
            <div key={panel.id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="font-semibold text-gray-800">{panel.name}</h2>
                  <p className="text-xs text-gray-400 mt-1">
                    {panel.members.length} member{panel.members.length !== 1 ? 's' : ''} ·{' '}
                    {panel.groups.length} group{panel.groups.length !== 1 ? 's' : ''} assigned
                  </p>
                  {panel.members.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {panel.members.map((m) => (
                        <span key={m.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setSelectedId(panel.id)}
                    className="text-sm px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                  >
                    Manage
                  </button>
                  <button
                    onClick={() => handleDelete(panel)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <PanelDetail
          key={selected.id}
          panel={selected}
          onClose={() => setSelectedId(null)}
          onChanged={() => mutate()}
        />
      )}
    </div>
  )
}
