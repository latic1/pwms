'use client'

import { useState } from 'react'
import { useReportSummary, useGroupReports, type GroupReport } from '@/hooks/useReports'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function grade(score: number | null): { label: string; color: string } {
  if (score == null) return { label: '—', color: 'text-gray-400' }
  if (score >= 70)   return { label: 'A', color: 'text-green-600' }
  if (score >= 60)   return { label: 'B', color: 'text-blue-600' }
  if (score >= 50)   return { label: 'C', color: 'text-yellow-600' }
  return { label: 'F', color: 'text-red-600' }
}

const proposalBadge: Record<string, string> = {
  approved: 'bg-green-100 text-green-700',
  pending:  'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
}

function exportCSV(groups: GroupReport[]) {
  const headers = [
    'Group', 'Supervisor', 'Members',
    'Proposal Status', 'Proposal Version',
    'Tasks Done', 'Tasks Total', 'Task %',
    'Final Report', 'Documents',
    'Supervisor Score', 'Examiner Score', 'Final Score', 'Grade',
  ]

  const rows = groups.map((g) => [
    g.groupName,
    g.supervisorName ?? 'Unassigned',
    g.memberCount,
    g.proposal?.status ?? 'None',
    g.proposal?.version ?? '',
    g.tasks.done,
    g.tasks.total,
    g.tasks.total > 0 ? Math.round((g.tasks.done / g.tasks.total) * 100) + '%' : '0%',
    g.hasFinalReport ? 'Yes' : 'No',
    g.docCount,
    g.supervisorScore ?? '',
    g.examinerScore ?? '',
    g.finalScore ?? '',
    grade(g.finalScore).label,
  ])

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${v}"`).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `fyp-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = 'bg-gray-900',
}: {
  label: string; value: string | number; sub?: string; accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { summary, isLoading: sumLoading } = useReportSummary()
  const { groups,  isLoading: grpLoading } = useGroupReports()

  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState<'all' | 'approved' | 'pending' | 'rejected' | 'none'>('all')
  const [sortKey, setSortKey] = useState<'name' | 'score' | 'tasks'>('name')

  const filtered = groups
    .filter((g) => {
      const matchSearch = g.groupName.toLowerCase().includes(search.toLowerCase()) ||
        (g.supervisorName ?? '').toLowerCase().includes(search.toLowerCase())
      const matchFilter = filter === 'all' || (g.proposal?.status ?? 'none') === filter
      return matchSearch && matchFilter
    })
    .sort((a, b) => {
      if (sortKey === 'score')
        return (b.finalScore ?? -1) - (a.finalScore ?? -1)
      if (sortKey === 'tasks') {
        const aPct = a.tasks.total ? a.tasks.done / a.tasks.total : 0
        const bPct = b.tasks.total ? b.tasks.done / b.tasks.total : 0
        return bPct - aPct
      }
      return a.groupName.localeCompare(b.groupName)
    })

  const taskPct = summary && summary.tasks.total > 0
    ? Math.round((summary.tasks.done / summary.tasks.total) * 100)
    : 0

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">System-wide progress and performance overview</p>
        </div>
        <button
          onClick={() => exportCSV(groups)}
          disabled={groups.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Summary cards ── */}
      {sumLoading ? (
        <p className="text-sm text-gray-400">Loading summary...</p>
      ) : summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Groups"
              value={summary.groups.total}
              sub={`${summary.groups.withoutSupervisor} without supervisor`}
            />
            <StatCard
              label="Proposals Approved"
              value={summary.proposals.approved}
              sub={`${summary.proposals.pending} pending · ${summary.proposals.rejected} rejected`}
            />
            <StatCard
              label="Task Completion"
              value={`${taskPct}%`}
              sub={`${summary.tasks.done} / ${summary.tasks.total} tasks done`}
            />
            <StatCard
              label="Grades Submitted"
              value={`${summary.grades.supervisorGraded} / ${summary.grades.total}`}
              sub={`${summary.grades.examinerGraded} examiner grades`}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Students"    value={summary.users.students} />
            <StatCard label="Supervisors" value={summary.users.supervisors} />
            <StatCard label="Final Reports Submitted" value={summary.documents.finalReports}
              sub={`${summary.documents.total} total documents`} />
            <StatCard label="No Proposal Yet" value={summary.proposals.none}
              sub="groups with no submission" />
          </div>

          {/* Proposal breakdown bar */}
          {summary.groups.total > 0 && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Proposal Status Breakdown</h2>
              <div className="flex rounded-full overflow-hidden h-4">
                {[
                  { count: summary.proposals.approved, color: 'bg-green-500', label: 'Approved' },
                  { count: summary.proposals.pending,  color: 'bg-yellow-400', label: 'Pending' },
                  { count: summary.proposals.rejected, color: 'bg-red-400',   label: 'Rejected' },
                  { count: summary.proposals.none,     color: 'bg-gray-200',  label: 'None' },
                ].map(({ count, color, label }) => {
                  const pct = (count / summary.groups.total) * 100
                  return pct > 0 ? (
                    <div
                      key={label}
                      title={`${label}: ${count}`}
                      className={`${color} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  ) : null
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
                {[
                  { count: summary.proposals.approved, color: 'bg-green-500', label: 'Approved' },
                  { count: summary.proposals.pending,  color: 'bg-yellow-400', label: 'Pending' },
                  { count: summary.proposals.rejected, color: 'bg-red-400',   label: 'Rejected' },
                  { count: summary.proposals.none,     color: 'bg-gray-200',  label: 'No submission' },
                ].map(({ count, color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    {label} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Per-group table ── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by group or supervisor..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex gap-1 flex-wrap">
            {(['all', 'approved', 'pending', 'rejected', 'none'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                {f === 'none' ? 'No proposal' : f}
              </button>
            ))}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="name">Sort: Name</option>
            <option value="score">Sort: Score ↓</option>
            <option value="tasks">Sort: Task % ↓</option>
          </select>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Group</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supervisor</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Members</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Proposal</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Tasks</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Final Report</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Sup. Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Exam. Score</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grpLoading ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-gray-400">No groups found.</td></tr>
              ) : (
                filtered.map((g) => {
                  const taskPct = g.tasks.total > 0
                    ? Math.round((g.tasks.done / g.tasks.total) * 100)
                    : 0
                  const g_ = grade(g.finalScore)

                  return (
                    <tr key={g.groupId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{g.groupName}</td>

                      <td className="px-4 py-3 text-gray-500">
                        {g.supervisorName ?? (
                          <span className="text-red-500 text-xs">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center text-gray-600">{g.memberCount}</td>

                      <td className="px-4 py-3">
                        {g.proposal ? (
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${proposalBadge[g.proposal.status] ?? ''}`}>
                              {g.proposal.status}
                            </span>
                            <span className="ml-1.5 text-xs text-gray-400">v{g.proposal.version}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-gray-600">{g.tasks.done}/{g.tasks.total}</span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${taskPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        {g.hasFinalReport ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Yes</span>
                        ) : (
                          <span className="text-xs text-gray-400">No</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center text-gray-700">
                        {g.supervisorScore != null ? g.supervisorScore : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="px-4 py-3 text-center text-gray-700">
                        {g.examinerScore != null ? g.examinerScore : <span className="text-gray-300">—</span>}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {g.finalScore != null ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-lg font-bold ${g_.color}`}>{g_.label}</span>
                            <span className="text-xs text-gray-400">{g.finalScore}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <p className="text-xs text-gray-400 text-right">
            Showing {filtered.length} of {groups.length} groups
          </p>
        )}
      </div>
    </div>
  )
}
