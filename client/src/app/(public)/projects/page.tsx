'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { useDebounce } from '@/hooks/useDebounce'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const fetcher  = (url: string) => fetch(url).then((r) => r.json())

interface PublicProject {
  groupId:       string
  groupName:     string
  title:         string
  abstract:      string
  department:    string | null
  program:       string | null
  supervisorName:string | null
  periodName:    string | null
  periodYear:    string | null
  avgScore:      number | null
  gradeCount:    number
  memberCount:   number
}

function scoreBadge(score: number | null) {
  if (!score) return null
  if (score >= 85) return { label: '🥇 Top Project',  color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' }
  if (score >= 75) return { label: '🥈 Distinction',  color: 'bg-slate-100 text-slate-700 border border-slate-300' }
  if (score >= 65) return { label: '🥉 Merit',        color: 'bg-orange-100 text-orange-700 border border-orange-200' }
  return null
}

function scoreColor(score: number) {
  if (score >= 70) return 'text-emerald-600'
  if (score >= 60) return 'text-blue-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export default function ProjectsPage() {
  const [search,     setSearch]     = useState('')
  const [department, setDepartment] = useState('')
  const [year,       setYear]       = useState('')
  const [supervisor, setSupervisor] = useState('')

  const debouncedSearch = useDebounce(search, 300)

  const { data: departments = [] } = useSWR<string[]>(`${API_BASE}/public/departments`, fetcher)
  const { data: supervisors = [] } = useSWR<{ id: string; name: string }[]>(`${API_BASE}/public/supervisors`, fetcher)

  const params = new URLSearchParams({ limit: '50' })
  if (debouncedSearch) params.set('search', debouncedSearch)
  if (department)      params.set('department', department)
  if (year)            params.set('year', year)
  if (supervisor)      params.set('supervisor', supervisor)

  const { data: projects = [], isLoading } = useSWR<PublicProject[]>(
    `${API_BASE}/public/projects?${params}`,
    fetcher
  )

  function clearFilters() {
    setSearch(''); setDepartment(''); setYear(''); setSupervisor('')
  }

  const hasFilters = search || department || year || supervisor
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i))

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Project Archive</h1>
        <p className="text-gray-500 mt-2">
          Browse approved Final Year Project submissions from all cohorts.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or topic..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Department */}
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {/* Year */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Supervisor */}
          <select
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Supervisors</option>
            {supervisors.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{projects.length} result{projects.length !== 1 ? 's' : ''} found</p>
            <button onClick={clearFilters} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
              Clear filters ×
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No projects found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const badge = scoreBadge(p.avgScore)
            return (
              <article
                key={p.groupId}
                className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                {/* Title + badge */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-800 leading-snug line-clamp-2 text-sm">{p.title}</h2>
                  {badge && (
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  )}
                </div>

                {/* Abstract */}
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{p.abstract}</p>

                {/* Meta */}
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {p.department && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{p.department}</span>
                  )}
                  {p.periodName && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.periodName}</span>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-400">
                    {p.supervisorName ? `Supervisor: ${p.supervisorName}` : 'No supervisor'}
                    <span className="mx-1.5">·</span>
                    {p.memberCount} member{p.memberCount !== 1 ? 's' : ''}
                  </div>
                  {p.avgScore !== null && (
                    <span className={`text-xs font-semibold ${scoreColor(p.avgScore)}`}>
                      {p.avgScore}/100
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
