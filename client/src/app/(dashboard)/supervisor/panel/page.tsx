'use client'

import Link from 'next/link'
import { useMyPanels } from '@/hooks/usePanels'

function getGrade(score: number) {
  if (score >= 70) return { label: 'A', color: 'text-green-600' }
  if (score >= 60) return { label: 'B', color: 'text-blue-600' }
  if (score >= 50) return { label: 'C', color: 'text-yellow-600' }
  return { label: 'F', color: 'text-red-600' }
}

export default function PanelDutyPage() {
  const { panels, isLoading } = useMyPanels()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel Duty</h1>
        <p className="text-sm text-gray-500 mt-1">
          Groups assigned to your examination panels for grading
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Loading...</div>
      ) : panels.length === 0 ? (
        <div className="text-center py-16 space-y-1">
          <p className="text-sm text-gray-500 font-medium">You are not on any examination panel.</p>
          <p className="text-xs text-gray-400">An admin can add you to a panel from the Panels page.</p>
        </div>
      ) : (
        panels.map((panel) => (
          <div key={panel.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-800">{panel.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                {panel.groups.length} group{panel.groups.length !== 1 ? 's' : ''}
              </span>
            </div>

            {panel.groups.length === 0 ? (
              <p className="text-sm text-gray-400 pl-1">No groups assigned to this panel yet.</p>
            ) : (
              <div className="space-y-3">
                {panel.groups.map((g) => (
                  <div key={g.id} className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800">{g.name}</h3>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                          <span>{g.memberCount} member{g.memberCount !== 1 ? 's' : ''}</span>
                          {g.hasFinalReport ? (
                            <span className="text-green-600">Final report submitted</span>
                          ) : (
                            <span className="text-amber-600">No final report yet</span>
                          )}
                        </p>
                      </div>

                      {g.isOwnGroup ? (
                        <span
                          title="You supervise this group, so you cannot panel-grade it"
                          className="shrink-0 text-xs px-3 py-2 rounded-md bg-gray-100 text-gray-500 border"
                        >
                          Your group — conflict
                        </span>
                      ) : g.myScore != null ? (
                        <div className="shrink-0 flex items-center gap-3">
                          <span className={`text-lg font-bold ${getGrade(g.myScore).color}`}>
                            {g.myScore}/100
                          </span>
                          <Link
                            href={`/supervisor/panel/${g.id}`}
                            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            View →
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={`/supervisor/panel/${g.id}`}
                          className="shrink-0 text-sm px-4 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-700 transition-colors"
                        >
                          Grade →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
