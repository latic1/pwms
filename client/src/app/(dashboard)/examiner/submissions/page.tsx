'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useGroups } from '@/hooks/useGroup'

function getGrade(score: number) {
  if (score >= 70) return { label: 'A', color: 'text-green-600' }
  if (score >= 60) return { label: 'B', color: 'text-blue-600' }
  if (score >= 50) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'F', color: 'text-red-600' }
}

export default function SubmissionsPage() {
  const { groups, isLoading } = useGroups()
  const [search, setSearch] = useState('')

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
        <p className="text-sm text-gray-500 mt-1">Review and grade final project submissions</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search groups..."
        className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-gray-400 py-8 text-center">No groups found.</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((g) => (
            <div key={g.id} className="bg-white rounded-xl border shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-800">{g.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {g.memberCount} member{g.memberCount !== 1 ? 's' : ''} ·{' '}
                    {g.supervisorId ? 'Supervisor assigned' : (
                      <span className="text-red-500">No supervisor</span>
                    )}
                  </p>
                </div>
                <Link
                  href={`/examiner/submissions/${g.id}`}
                  className="shrink-0 text-sm px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                >
                  Review →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
