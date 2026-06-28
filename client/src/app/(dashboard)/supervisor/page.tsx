'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { useGroups } from '@/hooks/useGroup'
import { useAllMeetings } from '@/hooks/useMeetings'
import { useAllProposals } from '@/hooks/useProposal'

export default function SupervisorDashboard() {
  const { user } = useAuth()
  const { groups }    = useGroups()
  const { meetings }  = useAllMeetings()
  const { proposals } = useAllProposals()

  const pendingProposals  = proposals.filter((p) => p.status === 'pending')
  const upcomingMeetings  = meetings.filter((m) => m.status !== 'completed')
  const gradedCount       = 0 // placeholder until grades hook per group

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Assigned Groups',    value: String(groups.length) },
          { label: 'Pending Proposals',  value: String(pendingProposals.length) },
          { label: 'Upcoming Meetings',  value: String(upcomingMeetings.length) },
          { label: 'Groups Graded',      value: `${gradedCount}/${groups.length}` },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Groups overview */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">My Groups</h2>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">No groups assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{g.name}</span>
                      <span className="text-xs text-gray-400">{g.memberCount} members</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '50%' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming meetings */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Upcoming Meetings</h2>
          {upcomingMeetings.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming meetings.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingMeetings.slice(0, 4).map((m) => (
                <li key={m.id} className="flex items-start justify-between text-sm">
                  <div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(m.scheduledAt).toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    m.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {m.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pending proposals */}
      {pendingProposals.length > 0 && (
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Proposals Awaiting Review</h2>
          <div className="space-y-3">
            {pendingProposals.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    v{p.version} · Submitted {new Date(p.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href="/supervisor/groups"
                  className="text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                >
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
