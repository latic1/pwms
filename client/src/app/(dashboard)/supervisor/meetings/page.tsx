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
  const [meetingType,    setMeetingType]    = useState<Meeting['meetingType']>('in_person')
  const [venue,          setVenue]          = useState('')
  const [meetingLink,    setMeetingLink]    = useState('')
  const [filter,         setFilter]         = useState<Meeting['status'] | 'all'>('all')
  const [scheduling,     setScheduling]     = useState(false)
  const [scheduleError,  setScheduleError]  = useState('')

  // Editing an existing meeting (reschedule / change notes)
  const [editingId,        setEditingId]        = useState<string | null>(null)
  const [editDate,         setEditDate]         = useState('')
  const [editTime,         setEditTime]         = useState('')
  const [editNotes,        setEditNotes]        = useState('')
  const [editMeetingType,  setEditMeetingType]  = useState<Meeting['meetingType']>('in_person')
  const [editVenue,        setEditVenue]        = useState('')
  const [editMeetingLink,  setEditMeetingLink]  = useState('')
  const [editBusy,    setEditBusy]    = useState(false)
  const [editError,   setEditError]  = useState('')

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault()
    const groupId = selectedGroup || groups[0]?.id
    if (!groupId) return
    setScheduling(true)
    setScheduleError('')
    try {
      await api.post(`/meetings/${groupId}`, {
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        notes: notes || undefined,
        meetingType,
        venue: meetingType === 'in_person' ? venue.trim() || undefined : undefined,
        meetingLink: meetingType === 'online' ? meetingLink.trim() || undefined : undefined,
      })
      await mutate()
      setShowForm(false)
      setDate('')
      setTime('')
      setNotes('')
      setMeetingType('in_person')
      setVenue('')
      setMeetingLink('')
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

  function startEdit(m: Meeting) {
    const d = new Date(m.scheduledAt)
    setEditingId(m.id)
    setEditDate(d.toISOString().slice(0, 10))
    setEditTime(d.toTimeString().slice(0, 5))
    setEditNotes(m.notes ?? '')
    setEditMeetingType(m.meetingType)
    setEditVenue(m.venue ?? '')
    setEditMeetingLink(m.meetingLink ?? '')
    setEditError('')
  }

  async function handleSaveEdit(m: Meeting) {
    setEditBusy(true)
    setEditError('')
    try {
      await api.patch(`/meetings/${m.groupId}/${m.id}`, {
        scheduledAt: new Date(`${editDate}T${editTime}`).toISOString(),
        notes: editNotes.trim() || undefined,
        meetingType: editMeetingType,
        // Explicitly clear whichever field doesn't apply to the chosen type,
        // not just omit it — otherwise switching type would leave the old
        // venue/link behind instead of replacing it.
        venue: editMeetingType === 'in_person' ? editVenue.trim() : '',
        meetingLink: editMeetingType === 'online' ? editMeetingLink.trim() : '',
      })
      await mutate()
      setEditingId(null)
    } catch (err: any) {
      setEditError(err?.response?.data?.error ?? 'Failed to update meeting.')
    } finally {
      setEditBusy(false)
    }
  }

  async function handleDelete(m: Meeting) {
    if (!confirm('Cancel this meeting? This cannot be undone.')) return
    try {
      await api.delete(`/meetings/${m.groupId}/${m.id}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to cancel meeting.')
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
        {groups.length > 0 && (
          <button
            onClick={() => { setShowForm(!showForm); setScheduleError('') }}
            className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors"
          >
            {showForm ? 'Cancel' : '+ Schedule Meeting'}
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500">
          You have no groups assigned yet — ask an admin to assign one before scheduling a meeting.
        </div>
      )}

      {/* Schedule form */}
      {showForm && groups.length > 0 && (
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Format</label>
              <div className="flex gap-2">
                {(['in_person', 'online'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMeetingType(t)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                      meetingType === t
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {t === 'in_person' ? '📍 In-person' : '💻 Online'}
                  </button>
                ))}
              </div>
            </div>

            {meetingType === 'in_person' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                <input
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Room 204, CS Building"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meeting link</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="e.g. https://meet.google.com/..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            )}

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
              {editingId === m.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        required
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(['in_person', 'online'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditMeetingType(t)}
                        className={`px-3 py-1 rounded-lg border-2 text-xs font-medium transition-colors ${
                          editMeetingType === t
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        {t === 'in_person' ? '📍 In-person' : '💻 Online'}
                      </button>
                    ))}
                  </div>

                  {editMeetingType === 'in_person' ? (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Venue</label>
                      <input
                        value={editVenue}
                        onChange={(e) => setEditVenue(e.target.value)}
                        placeholder="e.g. Room 204, CS Building"
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Meeting link</label>
                      <input
                        type="url"
                        value={editMeetingLink}
                        onChange={(e) => setEditMeetingLink(e.target.value)}
                        placeholder="e.g. https://meet.google.com/..."
                        className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Agenda / Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                    />
                  </div>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-3 py-1.5 rounded-md border text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(m)}
                      disabled={editBusy || !editDate || !editTime}
                      className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
                    >
                      {editBusy ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(m.scheduledAt).toLocaleString([], {
                          weekday: 'long', year: 'numeric', month: 'short',
                          day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {m.meetingType === 'in_person' ? (
                          <>📍 {m.venue || 'Venue not set'}</>
                        ) : m.meetingLink ? (
                          <a
                            href={m.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            💻 Join meeting link
                          </a>
                        ) : (
                          '💻 Meeting link not set'
                        )}
                      </p>
                      {m.notes && (
                        <p className="text-xs text-gray-400 mt-2 italic">&quot;{m.notes}&quot;</p>
                      )}
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusStyles[m.status]}`}>
                      {m.status}
                    </span>
                  </div>

                  {m.status !== 'completed' && (
                    <div className="flex gap-2 mt-4 flex-wrap">
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
                      <button
                        onClick={() => startEdit(m)}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(m)}
                        className="text-xs px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Cancel meeting
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
