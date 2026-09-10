'use client'

import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useProposal } from '@/hooks/useProposal'
import { useTasks } from '@/hooks/useTasks'
import { useMeetings } from '@/hooks/useMeetings'
import { useGrades } from '@/hooks/useGrades'
import { useActivePeriod } from '@/hooks/usePeriods'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import api from '@/lib/api'
import type { Meeting } from '@/types'

const meetingStatusStyles: Record<Meeting['status'], string> = {
  proposed:  'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

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
  const { meetings, mutate: mutateMeetings } = useMeetings(group?.id ?? null)
  const { period } = useActivePeriod()
  const { grades, finalScore, supervisorScore, panelAverage, panelCount } = useGrades(
    period?.gradesReleased ? group?.id ?? null : null
  )

  const doneTasks    = tasks.filter((t) => t.status === 'done').length
  const pendingTasks = tasks.filter((t) => t.status !== 'done').length
  const upcomingMeetings = meetings.filter((m) => m.status !== 'completed')

  async function confirmMeeting(meeting: Meeting) {
    try {
      await api.patch(`/meetings/${meeting.groupId}/${meeting.id}`, { status: 'confirmed' })
      mutateMeetings()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to confirm meeting.')
    }
  }

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
                            : task.status === 'changes_requested'
                            ? 'bg-amber-100 text-amber-700'
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

          {upcomingMeetings.length > 0 && (
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Upcoming Meetings</h2>
              <div className="space-y-2">
                {upcomingMeetings.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2 border">
                    <div className="min-w-0">
                      <p className="text-gray-700 truncate">
                        {new Date(m.scheduledAt).toLocaleString([], {
                          weekday: 'short', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      {m.notes && <p className="text-xs text-gray-400 truncate">{m.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.status === 'proposed' && (
                        <button
                          onClick={() => confirmMeeting(m)}
                          className="text-xs px-2.5 py-1 rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors"
                        >
                          Confirm
                        </button>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meetingStatusStyles[m.status]}`}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {period?.gradesReleased && finalScore != null && (
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-3">Your Grade</h2>
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2">
                  <p className="text-xs text-gray-500">Final Score</p>
                  <p className="text-2xl font-bold text-indigo-700">{finalScore}/100</p>
                </div>
                {supervisorScore != null && (
                  <p className="text-sm text-gray-500">Supervisor: <span className="font-medium text-gray-700">{supervisorScore}/100</span></p>
                )}
                {panelCount > 0 && panelAverage != null && (
                  <p className="text-sm text-gray-500">Panel average: <span className="font-medium text-gray-700">{panelAverage}/100</span></p>
                )}
              </div>
              {grades.filter((g) => g.feedback).map((g) => (
                <p key={g.id} className="text-sm text-gray-600 italic border-t pt-3 mt-1 first:border-t-0 first:pt-0 first:mt-0">
                  <span className="not-italic font-medium text-gray-700 capitalize">{g.graderRole}: </span>
                  &ldquo;{g.feedback}&rdquo;
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </>
  )
}
