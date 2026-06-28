'use client'

import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useTasks } from '@/hooks/useTasks'
import { useState } from 'react'
import api from '@/lib/api'
import type { Task } from '@/types'

const statusOrder: Task['status'][] = ['pending', 'in_progress', 'under_review', 'done']

const statusStyles: Record<Task['status'], string> = {
  pending:      'bg-gray-100 text-gray-600',
  in_progress:  'bg-blue-100 text-blue-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  done:         'bg-green-100 text-green-700',
}

const statusLabels: Record<Task['status'], string> = {
  pending:      'Pending',
  in_progress:  'In Progress',
  under_review: 'Under Review',
  done:         'Done',
}

const nextStatus: Record<Task['status'], Task['status'] | null> = {
  pending:      'in_progress',
  in_progress:  'under_review',
  under_review: 'done',
  done:         null,
}

export default function TasksPage() {
  const { user } = useAuth()
  const { group } = useMyGroup()
  const { tasks, mutate } = useTasks(group?.id ?? null)

  const [filter,     setFilter]     = useState<Task['status'] | 'all'>('all')
  const [advancing,  setAdvancing]  = useState<string | null>(null)

  async function advanceStatus(task: Task) {
    const next = nextStatus[task.status]
    if (!next) return
    setAdvancing(task.id)
    try {
      await api.patch(`/tasks/${task.id}`, { status: next })
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to update task.')
    } finally {
      setAdvancing(null)
    }
  }

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)

  const counts = {
    all:          tasks.length,
    pending:      tasks.filter((t) => t.status === 'pending').length,
    in_progress:  tasks.filter((t) => t.status === 'in_progress').length,
    under_review: tasks.filter((t) => t.status === 'under_review').length,
    done:         tasks.filter((t) => t.status === 'done').length,
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-1">Track and update your group's project tasks</p>
      </div>

      {!group ? (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 text-center">
          You must be in a group to view tasks.
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Overall Progress</span>
              <span className="font-medium">{counts.done}/{tasks.length} done</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-green-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${tasks.length ? (counts.done / tasks.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {(['all', ...statusOrder] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === s
                    ? 'bg-gray-900 text-white'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === 'all' ? 'All' : statusLabels[s]}
                <span className="ml-1.5 opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">No tasks in this category.</div>
            ) : (
              filtered.map((task) => {
                const isAssignee = task.assigneeId === user?.id
                const canAdvance = isAssignee && task.status !== 'done'
                const overdue    = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done'

                return (
                  <div
                    key={task.id}
                    className={`bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4 ${
                      task.status === 'done' ? 'opacity-60' : ''
                    }`}
                  >
                    <div
                      className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        task.status === 'done' ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}
                    >
                      {task.status === 'done' && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <p className={`text-sm font-medium text-gray-800 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
                          {task.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusStyles[task.status]}`}>
                          {statusLabels[task.status]}
                        </span>
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                        {task.assigneeId && (
                          <span>
                            Assignee:{' '}
                            <span className="text-gray-600 font-medium">
                              {group.members.find((m) => m.id === task.assigneeId)?.name ?? 'Unknown'}
                              {isAssignee && ' (you)'}
                            </span>
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={overdue ? 'text-red-500 font-medium' : ''}>
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                            {overdue && ' · Overdue'}
                          </span>
                        )}
                      </div>
                    </div>

                    {canAdvance && (
                      <button
                        onClick={() => advanceStatus(task)}
                        disabled={advancing === task.id}
                        className="shrink-0 text-xs px-3 py-1.5 rounded-md bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
                      >
                        {advancing === task.id ? '...' : `Mark as ${statusLabels[nextStatus[task.status]!]}`}
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
