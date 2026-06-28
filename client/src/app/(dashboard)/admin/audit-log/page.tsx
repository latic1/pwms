'use client'

import { useState } from 'react'
import { useAuditLog } from '@/hooks/useAuditLog'

const targetTypeStyles: Record<string, string> = {
  user:     'bg-blue-100 text-blue-700',
  group:    'bg-purple-100 text-purple-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  task:     'bg-teal-100 text-teal-700',
  document: 'bg-orange-100 text-orange-700',
  period:   'bg-gray-100 text-gray-700',
  grade:    'bg-green-100 text-green-700',
}

const roleColors: Record<string, string> = {
  admin:      'text-purple-600',
  supervisor: 'text-green-600',
  student:    'text-blue-600',
  examiner:   'text-orange-600',
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditLogPage() {
  const [page,       setPage]       = useState(1)
  const [action,     setAction]     = useState('')
  const [targetType, setTargetType] = useState('')

  const { logs, pagination, isLoading } = useAuditLog({
    page,
    limit: 20,
    action: action || undefined,
    targetType: targetType || undefined,
  })

  const targetTypes = ['user', 'group', 'proposal', 'task', 'document', 'period', 'grade']

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Complete record of all system actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          placeholder="Filter by action..."
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => { setTargetType(''); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !targetType ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {targetTypes.map((t) => (
            <button
              key={t}
              onClick={() => { setTargetType(t); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                targetType === t ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Log table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-600">Actor</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Action</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Target ID</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">Loading...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">No log entries found.</td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800">{l.actorName ?? 'System'}</p>
                    {l.actorRole && (
                      <p className={`text-xs capitalize ${roleColors[l.actorRole] ?? 'text-gray-400'}`}>
                        {l.actorRole}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-700 font-mono text-xs">{l.action}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                    {l.targetId ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                      targetTypeStyles[l.targetType] ?? 'bg-gray-100 text-gray-600'
                    }`}>
                      {l.targetType}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {formatTimestamp(l.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="border-t px-5 py-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="px-3 py-1 rounded border text-xs disabled:opacity-40 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
