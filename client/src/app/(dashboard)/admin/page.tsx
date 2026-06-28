'use client'

import Link from 'next/link'
import { useUsers } from '@/hooks/useUsers'
import { useGroups } from '@/hooks/useGroup'
import { useActivePeriod } from '@/hooks/usePeriods'
import { useAuditLog } from '@/hooks/useAuditLog'
import { useAllProposals } from '@/hooks/useProposal'

export default function AdminDashboard() {
  const { users }   = useUsers()
  const { groups }  = useGroups()
  const { period }  = useActivePeriod()
  const { logs }    = useAuditLog({ limit: 5 })
  const { proposals } = useAllProposals()

  const unassigned = groups.filter((g) => !g.supervisorId).length
  const pending    = proposals.filter((p) => p.status === 'pending').length

  const deadlines = period
    ? [
        { label: 'Group Formation',    date: period.groupDeadline },
        { label: 'Proposal Submission', date: period.proposalDeadline },
        { label: 'Final Submission',    date: period.submissionDeadline },
      ]
    : []

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">{period?.name ?? 'No active period'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Users',        value: users.length },
          { label: 'Active Groups',      value: groups.length },
          { label: 'Unassigned Groups',  value: unassigned },
          { label: 'Pending Proposals',  value: pending },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border shadow-sm p-5">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Deadlines */}
        {period && (
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Deadlines</h2>
              <Link href="/admin/periods" className="text-xs text-blue-600 hover:underline">Manage →</Link>
            </div>
            <ul className="space-y-3">
              {deadlines.map((d) => {
                const passed = new Date(d.date) < new Date()
                return (
                  <li key={d.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{d.label}</span>
                    <span className={`font-medium ${passed ? 'text-red-500 line-through' : 'text-gray-800'}`}>
                      {new Date(d.date).toLocaleDateString()}
                    </span>
                  </li>
                )
              })}
            </ul>
            <div className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
              period.gradesReleased
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-500 border'
            }`}>
              Grades: {period.gradesReleased ? 'Released to students' : 'Not yet released'}
            </div>
          </div>
        )}

        {/* Groups status */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Groups Status</h2>
            <Link href="/admin/groups" className="text-xs text-blue-600 hover:underline">Manage →</Link>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-400">No groups yet.</p>
          ) : (
            <div className="space-y-3">
              {groups.slice(0, 6).map((g) => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{g.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{g.memberCount}/3</span>
                    {g.supervisorId ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Assigned</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">No supervisor</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Recent Activity</h2>
          <Link href="/admin/audit-log" className="text-xs text-blue-600 hover:underline">Full log →</Link>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="text-gray-700 font-mono text-xs">{l.action}</span>
                  {l.actorName && (
                    <>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{l.actorName}</span>
                    </>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-4">
                  {new Date(l.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
