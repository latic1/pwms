'use client'

import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useProposal } from '@/hooks/useProposal'
import { useTasks } from '@/hooks/useTasks'
import { useActivePeriod } from '@/hooks/usePeriods'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const { group, isLoading: groupLoading } = useMyGroup()
  const { proposal } = useProposal(group?.id ?? null)
  const { tasks } = useTasks(group?.id ?? null)
  const { period } = useActivePeriod()

  const doneTasks    = tasks.filter((t) => t.status === 'done').length
  const pendingTasks = tasks.filter((t) => t.status !== 'done').length

  return (
    <>
    <OnboardingWizard />
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-gray-500 text-sm mt-1">{period?.name ?? 'No active academic period'}</p>
      </div>

      {groupLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : !group ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
          You are not part of a group yet. Go to <strong>My Group</strong> to create or join one.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Group"
              value={group.name}
              sub={`${group.members.length} member${group.members.length !== 1 ? 's' : ''}`}
            />
            <StatCard
              label="Proposal"
              value={proposal?.status ?? 'Not submitted'}
              sub={proposal ? `v${proposal.version}` : undefined}
            />
            <StatCard label="Tasks Done"    value={`${doneTasks}/${tasks.length}`} />
            <StatCard label="Pending Tasks" value={String(pendingTasks)} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {period && (
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">Upcoming Deadlines</h2>
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between text-gray-600">
                    <span>Group Formation</span>
                    <span className="font-medium">
                      {new Date(period.groupDeadline).toLocaleDateString()}
                    </span>
                  </li>
                  <li className="flex justify-between text-gray-600">
                    <span>Proposal Submission</span>
                    <span className="font-medium">
                      {new Date(period.proposalDeadline).toLocaleDateString()}
                    </span>
                  </li>
                  <li className="flex justify-between text-gray-600">
                    <span>Final Submission</span>
                    <span className="font-medium">
                      {new Date(period.submissionDeadline).toLocaleDateString()}
                    </span>
                  </li>
                </ul>
              </div>
            )}

            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Recent Tasks</h2>
              {tasks.length === 0 ? (
                <p className="text-sm text-gray-400">No tasks yet.</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.slice(0, 4).map((task) => (
                    <li key={task.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 truncate">{task.title}</span>
                      <span
                        className={`ml-2 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                          task.status === 'done'
                            ? 'bg-green-100 text-green-700'
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : task.status === 'under_review'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </>
  )
}
