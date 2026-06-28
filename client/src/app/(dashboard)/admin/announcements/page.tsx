'use client'

import { useState } from 'react'
import useSWR from 'swr'
import api from '@/lib/api'

const fetcher = (url: string) => api.get(url).then((r) => r.data)

type AnnType = 'info' | 'warning' | 'deadline' | 'success'

interface Announcement {
  id:          string
  title:       string
  body:        string
  type:        AnnType
  pinned:      boolean
  publishedAt: string | null
  expiresAt:   string | null
  createdAt:   string
}

const typeStyles: Record<AnnType, { bar: string; badge: string; label: string }> = {
  info:     { bar: 'bg-blue-600',    badge: 'bg-blue-100 text-blue-700',     label: 'Info' },
  warning:  { bar: 'bg-amber-500',   badge: 'bg-amber-100 text-amber-700',   label: 'Warning' },
  deadline: { bar: 'bg-red-600',     badge: 'bg-red-100 text-red-700',       label: 'Deadline' },
  success:  { bar: 'bg-emerald-600', badge: 'bg-emerald-100 text-emerald-700', label: 'Success' },
}

const blank = {
  title:       '',
  body:        '',
  type:        'info' as AnnType,
  pinned:      false,
  publishedAt: new Date().toISOString().slice(0, 16),
  expiresAt:   '',
}

export default function AnnouncementsPage() {
  const { data: items = [], isLoading, mutate } = useSWR<Announcement[]>('/admin/announcements', fetcher)

  const [form,    setForm]    = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [showForm,setShowForm]= useState(false)

  function startNew() {
    setForm(blank)
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  function startEdit(a: Announcement) {
    setForm({
      title:       a.title,
      body:        a.body,
      type:        a.type,
      pinned:      a.pinned,
      publishedAt: a.publishedAt ? a.publishedAt.slice(0, 16) : '',
      expiresAt:   a.expiresAt   ? a.expiresAt.slice(0, 16)   : '',
    })
    setEditing(a.id)
    setError('')
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditing(null)
    setError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        title:       form.title.trim(),
        body:        form.body.trim(),
        type:        form.type,
        pinned:      form.pinned,
        publishedAt: form.publishedAt || null,
        expiresAt:   form.expiresAt   || null,
      }
      if (editing) {
        await api.patch(`/admin/announcements/${editing}`, payload)
      } else {
        await api.post('/admin/announcements', payload)
      }
      await mutate()
      cancel()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return
    try {
      await api.delete(`/admin/announcements/${id}`)
      await mutate()
    } catch {
      alert('Failed to delete announcement.')
    }
  }

  async function togglePin(a: Announcement) {
    try {
      await api.patch(`/admin/announcements/${a.id}`, { pinned: !a.pinned })
      await mutate()
    } catch {
      alert('Failed to update.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Publish notices and deadlines that appear on the public landing page.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New announcement
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-5">
            {editing ? 'Edit announcement' : 'New announcement'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Group Formation Deadline — 31 January"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  required
                  rows={3}
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Full announcement text..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AnnType }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="deadline">Deadline</option>
                  <option value="warning">Warning</option>
                </select>
              </div>

              <div className="flex items-center gap-3 mt-5">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-600"
                />
                <label htmlFor="pinned" className="text-sm text-gray-700">
                  Pin to top of announcements
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Publish at</label>
                <input
                  type="datetime-local"
                  value={form.publishedAt}
                  onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expires at <span className="text-gray-400">(optional)</span></label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={cancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">📢</p>
          <p className="font-medium">No announcements yet</p>
          <p className="text-sm mt-1">Create one to display it on the landing page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const s = typeStyles[a.type] ?? typeStyles.info
            const isExpired = a.expiresAt ? new Date(a.expiresAt) < new Date() : false
            const isDraft   = !a.publishedAt || new Date(a.publishedAt) > new Date()
            return (
              <div key={a.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isExpired ? 'opacity-50' : ''}`}>
                <div className={`h-1 ${s.bar}`} />
                <div className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-medium text-gray-800 text-sm">{a.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                      {a.pinned && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">📌 Pinned</span>
                      )}
                      {isDraft && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
                      )}
                      {isExpired && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {a.publishedAt && <span>Published {new Date(a.publishedAt).toLocaleDateString()}</span>}
                      {a.expiresAt   && <span>· Expires {new Date(a.expiresAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePin(a)}
                      title={a.pinned ? 'Unpin' : 'Pin'}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill={a.pinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 9V5.25m0 0A2.25 2.25 0 0014.25 3h-4.5A2.25 2.25 0 007.5 5.25V9m9 0l1.5 7.5H5.25L6.75 9m9.75 0H7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startEdit(a)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(a.id, a.title)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
