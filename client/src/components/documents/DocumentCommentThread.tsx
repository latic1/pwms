'use client'

import { useState } from 'react'
import { useDocumentComments, addDocumentComment } from '@/hooks/useDocumentComments'

export function DocumentCommentThread({ groupId, docId }: { groupId: string; docId: string }) {
  const [open, setOpen] = useState(false)
  const { comments, mutate } = useDocumentComments(open ? groupId : null, open ? docId : null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try {
      await addDocumentComment(groupId, docId, text.trim())
      setText('')
      await mutate()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to add comment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        {open ? 'Hide comments' : `Comments${comments.length ? ` (${comments.length})` : ''}`}
      </button>

      {open && (
        <div className="mt-2 space-y-2 bg-gray-50 rounded-lg border p-3">
          {comments.length === 0 ? (
            <p className="text-xs text-gray-400">No comments yet.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="text-xs">
                <span className="font-medium text-gray-700">{c.authorName}</span>
                <span className="text-gray-400 ml-1 capitalize">({c.authorRole})</span>
                <span className="text-gray-400 ml-2">{new Date(c.createdAt).toLocaleDateString()}</span>
                <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{c.body}</p>
              </div>
            ))
          )}
          <form onSubmit={handleAdd} className="flex gap-2 pt-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 shrink-0"
            >
              {busy ? '...' : 'Send'}
            </button>
          </form>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
