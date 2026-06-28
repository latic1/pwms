'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useGroups } from '@/hooks/useGroup'

export default function ExaminerDashboard() {
  const { user } = useAuth()
  const { groups } = useGroups()

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Groups', value: groups.length },
          { label: 'Awaiting Grade', value: groups.length },
          { label: 'Your Role', value: 'Examiner' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Groups to grade */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Groups to Review</h2>
          <Link href="/examiner/submissions" className="text-xs text-blue-600 hover:underline">
            View all →
          </Link>
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400">No groups found.</p>
        ) : (
          <div className="space-y-3">
            {groups.slice(0, 5).map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between p-4 rounded-lg bg-orange-50 border border-orange-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{g.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {g.memberCount} member{g.memberCount !== 1 ? 's' : ''} ·{' '}
                    {g.supervisorId ? 'Supervisor assigned' : 'No supervisor'}
                  </p>
                </div>
                <Link
                  href={`/examiner/submissions/${g.id}`}
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors shrink-0 ml-4"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
