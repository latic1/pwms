'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import api from '@/lib/api'
import type { GroupMember } from '@/types'

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
]

function Avatar({ name, index }: { name: string; index: number }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase()
  const color = avatarColors[index % avatarColors.length]
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold ${color}`}>
      {initials}
    </span>
  )
}

export default function GroupPage() {
  const { user } = useAuth()
  const { group, isLoading, mutate } = useMyGroup()

  const [inviteCopied, setInviteCopied] = useState(false)
  const [joinCode,     setJoinCode]     = useState('')
  const [joinError,    setJoinError]    = useState('')
  const [joinLoading,  setJoinLoading]  = useState(false)
  const [groupName,    setGroupName]    = useState('')
  const [createError,  setCreateError]  = useState('')
  const [creating,     setCreating]     = useState(false)

  const isLeader = group?.leaderId === user?.id

  function handleCopyCode() {
    if (!group) return
    navigator.clipboard.writeText(group.inviteCode)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoinError('')
    setJoinLoading(true)
    try {
      await api.post('/groups/join', { inviteCode: joinCode.trim().toUpperCase() })
      mutate()
      setJoinCode('')
    } catch (err: any) {
      setJoinError(err?.response?.data?.error ?? 'Failed to join group.')
    } finally {
      setJoinLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.post('/groups', { name: groupName.trim() })
      mutate()
    } catch (err: any) {
      setCreateError(err?.response?.data?.error ?? 'Failed to create group.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRemoveMember(member: GroupMember) {
    if (!group) return
    if (!confirm(`Remove ${member.name} from the group?`)) return
    try {
      await api.delete(`/groups/${group.id}/members/${member.id}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to remove member.')
    }
  }

  if (isLoading) {
    return <div className="text-sm text-gray-400 p-4">Loading...</div>
  }

  // No group yet — show create / join options
  if (!group) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Group</h1>
          <p className="text-sm text-gray-500 mt-1">You are not in a group yet.</p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Create a Group</h2>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              required
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
          {createError && <p className="text-xs text-red-600">{createError}</p>}
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Join a Group</h2>
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Invite code e.g. ALPHA-7X2K"
              required
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={joinLoading}
              className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              {joinLoading ? 'Joining...' : 'Join'}
            </button>
          </form>
          {joinError && <p className="text-xs text-red-600">{joinError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Group</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your project group and members</p>
      </div>

      {/* Group Info */}
      <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{group.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Formed on {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
            Active
          </span>
        </div>

        {group.supervisor && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium text-gray-700">Supervisor:</span>
            <span>{group.supervisor.name}</span>
          </div>
        )}

        {/* Invite Code — leader only */}
        {isLeader && (
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
              Invite Code
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xl font-mono font-bold tracking-widest text-gray-800">
                {group.inviteCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              >
                {inviteCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Share this code with students you want to invite. Max 3 members.
            </p>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <h2 className="font-semibold text-gray-800 mb-4">
          Members ({group.members.length}/3)
        </h2>
        <ul className="space-y-3">
          {group.members.map((member, i) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} index={i} />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {member.name}
                    {member.id === group.leaderId && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                        Leader
                      </span>
                    )}
                    {member.id === user?.id && (
                      <span className="ml-2 text-xs text-gray-400">(you)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{member.email}</p>
                  {member.indexNumber && (
                    <p className="text-xs text-gray-400">
                      {member.indexNumber}
                      {member.program ? ` · ${member.program}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {isLeader && member.id !== user?.id && member.id !== group.leaderId && (
                <button
                  onClick={() => handleRemoveMember(member)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {group.members.length < 3 && (
          <p className="mt-4 text-xs text-gray-400 border-t pt-3">
            {3 - group.members.length} slot{3 - group.members.length > 1 ? 's' : ''} remaining
          </p>
        )}
      </div>
    </div>
  )
}
