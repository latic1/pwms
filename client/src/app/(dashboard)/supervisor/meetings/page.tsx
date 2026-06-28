'use client'

import { useState } from 'react'
import { useAllMeetings } from '@/hooks/useMeetings'
import { useGroups } from '@/hooks/useGroup'
import api from '@/lib/api'
import type { Meeting } from '@/types'

const statusStyles: Record<Meeting['status'], string> = {
  proposed:  'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

export default function MeetingsPage() {
  const { groups } = useGroups()
  const { meetings, mutate } = useAllMeetings()

  const [showForm,       setShowForm]       = useState(false)
  const [selectedGroup,  setSelectedGroup]  = useState('')
  const [date,           setDate]           = useState('')
  const [time,           setTime]           = useState('')
  const [notes,          setNotes]          = useState('')
  const [filter,         setFilter]         = useState<Meeting['status'] | 'all'>('all')
  const [scheduling,     setScheduling]     = useState(false)
  const [scheduleError,  setScheduleError]  = useState('')

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroup && groups.length > 0) return
    const groupId = selectedGroup || groups[0]?.id
    if (!groupId) return
    setScheduling(true)
    setScheduleError('')
    try {
      await api.post(`/meetings/${groupId}`, {
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        notes: notes || undefined,
      })
      await mutate()
      setShowForm(false)
      setDate('')
      setTime('')
      setNotes('')
    } catch (err: any) {
      setScheduleError(err?.response?.data?.error ?? 'Failed to schedule meeting.')
    } finally {
      setScheduling(false)
    }
  }

  async function updateStatus(meeting: Meeting, status: Meeting['status']) {
    try {
      await api.patch(`/meetings/${meeting.groupId}/${meeting.id}`, { status })
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to update meeting.')
    }
  }

  const filtered = filter === 'all' ? meetings : meetings.filter((m) => m.status === filter)
  const counts = {
    all:       meetings.length,
    proposed:  meetings.filter((m) => m.status === 'proposed').length,
    confirmed: meetings.filter((m) => m.status === 'confirmed').length,
    completed: meetings.filter((m) => m.status === 'completed').length,
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-sm text-gray-500 mt-1">Schedule and manage meetings with your groups</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setScheduleError('') }}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Schedule Meeting'}
        </button>
      </div>

      {/* Schedule form */}
      {showForm && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">New Meeting</h2>
          <form onSubmit={handleSchedule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
              <select
                value={selectedGroup || groups[0]?.id || ''}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agenda / Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Topics to discuss..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
            {scheduleError && <p className="text-sm text-red-600">{scheduleError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={scheduling}
                className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                {scheduling ? 'Scheduling...' : 'Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['all', 'proposed', 'confirmed', 'completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === s ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s} <span className="ml-1 opacity-60">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Meeting list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No meetings found.</div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {new Date(m.scheduledAt).toLocaleString([], {
                      weekday: 'long', year: 'numeric', month: 'short',
                      day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {m.notes && (
                    <p className="text-xs text-gray-400 mt-2 italic">"{m.notes}"</p>
                  )}
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusStyles[m.status]}`}>
                  {m.status}
                </span>
              </div>

              {m.status !== 'completed' && (
                <div className="flex gap-2 mt-4">
                  {m.status === 'proposed' && (
                    <button
                      onClick={() => updateStatus(m, 'confirmed')}
                      className="text-xs px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      Confirm
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(m, 'completed')}
                    className="text-xs px-3 py-1.5 rounded-md border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    Mark Complete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
