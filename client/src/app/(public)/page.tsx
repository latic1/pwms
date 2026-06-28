'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const roleHome: Record<Role, string> = {
  student:    '/student',
  supervisor: '/supervisor',
  admin:      '/admin',
  examiner:   '/examiner',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Announcement {
  id:          string
  title:       string
  body:        string
  type:        'info' | 'warning' | 'deadline' | 'success'
  pinned:      boolean
  publishedAt: string
}

interface PublicProject {
  groupId:       string
  groupName:     string
  title:         string
  abstract:      string
  department:    string | null
  supervisorName:string | null
  periodName:    string | null
  avgScore:      number | null
  memberCount:   number
}

interface Stats {
  groups:            number
  students:          number
  approvedProposals: number
  periods:           number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Helpers ──────────────────────────────────────────────────────────────────

const announcementStyles = {
  info:     { bar: 'bg-blue-600',   badge: 'bg-blue-100 text-blue-700',   icon: '📢' },
  warning:  { bar: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', icon: '⚠️' },
  deadline: { bar: 'bg-red-600',    badge: 'bg-red-100 text-red-700',     icon: '🗓️' },
  success:  { bar: 'bg-emerald-600',badge: 'bg-emerald-100 text-emerald-700', icon: '✅' },
}

function scoreBadge(score: number | null) {
  if (!score) return null
  if (score >= 85) return { label: '🥇 Top Project', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300' }
  if (score >= 75) return { label: '🥈 Distinction', color: 'bg-gray-100 text-gray-700 border border-gray-300' }
  if (score >= 65) return { label: '🥉 Merit',       color: 'bg-orange-100 text-orange-700 border border-orange-200' }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const { data: announcements = [] } = useSWR<Announcement[]>(`${API_BASE}/public/announcements`, fetcher)
  const { data: stats }              = useSWR<Stats>(`${API_BASE}/public/stats`, fetcher)
  const { data: topProjects = [] }   = useSWR<PublicProject[]>(
    `${API_BASE}/public/projects?limit=6`, fetcher
  )

  // Redirect logged-in users straight to their dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace(roleHome[user.role] ?? '/login')
    }
  }, [user, loading, router])

  if (loading || user) return null

  return (
    <div className="space-y-0">

      {/* ── Announcements banner ── */}
      {announcements.length > 0 && (
        <div className="space-y-0">
          {announcements.slice(0, 3).map((a) => {
            const s = announcementStyles[a.type] ?? announcementStyles.info
            return (
              <div key={a.id} className={`${s.bar} text-white px-6 py-3`}>
                <div className="max-w-6xl mx-auto flex items-start gap-3">
                  <span className="text-lg shrink-0 leading-6">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold">{a.title}</span>
                    <span className="mx-2 opacity-60">·</span>
                    <span className="text-sm opacity-90">{a.body}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 text-white overflow-hidden">
        {/* Grid decoration */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white/80 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Final Year Project Management — Open for 2024/2025
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Manage your FYP<br />
            <span className="text-indigo-400">from start to submission</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto mb-10">
            Form groups, submit proposals, track tasks, collaborate with your supervisor,
            and deliver your final report — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-900/40"
            >
              Get started →
            </Link>
            <Link
              href="/projects"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-colors"
            >
              Browse past projects
            </Link>
            <Link
              href="/how-it-works"
              className="px-6 py-3 rounded-xl text-gray-400 hover:text-white text-sm transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      {stats && (
        <section className="bg-indigo-600 text-white">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Student Groups',      value: stats.groups },
              { label: 'Students Enrolled',   value: stats.students },
              { label: 'Approved Proposals',  value: stats.approvedProposals },
              { label: 'Academic Periods',    value: stats.periods },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-3xl font-bold">{s.value}</p>
                <p className="text-sm text-indigo-200 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900">Everything in one system</h2>
          <p className="text-gray-500 mt-2 max-w-xl mx-auto">
            Designed for students, supervisors, examiners, and admin staff.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-4 ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hall of Fame ── */}
      {topProjects.length > 0 && (
        <section className="bg-gray-50 border-y border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gray-900">🏆 Hall of Fame</h2>
              <p className="text-gray-500 mt-2">Top-graded projects from our students</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {topProjects.map((p) => {
                const badge = scoreBadge(p.avgScore)
                return (
                  <div key={p.groupId} className="bg-white rounded-2xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-800 leading-snug line-clamp-2">{p.title}</h3>
                      {badge && (
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{p.abstract}</p>
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-gray-100">
                      {p.department && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{p.department}</span>
                      )}
                      {p.periodName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{p.periodName}</span>
                      )}
                      {p.avgScore && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                          Avg {p.avgScore}/100
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="text-center mt-8">
              <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                Browse all projects →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── How it works (teaser) ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">New to FYP-WMS?</h2>
            <p className="text-gray-500 mb-6 leading-relaxed">
              We've built step-by-step guides for every role — students, supervisors, and examiners.
              Get up to speed in minutes, not days.
            </p>
            <div className="space-y-3">
              {[
                'Form or join a group with a single invite code',
                'Submit proposals and track supervisor feedback',
                'Manage tasks, documents, and messages in one place',
                'Get graded fairly by both supervisor and examiner',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
            <Link href="/how-it-works" className="inline-flex items-center gap-1 mt-8 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              Read the full guide →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {steps.map((s, i) => (
              <div key={s.title} className="bg-white border rounded-xl p-4 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center mb-3">
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-indigo-600 text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start your FYP journey?</h2>
          <p className="text-indigo-200 mb-8">
            Sign in with your university credentials and get your group running today.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3 rounded-xl bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
          >
            Sign in now →
          </Link>
        </div>
      </section>
    </div>
  )
}

// ─── Static data ──────────────────────────────────────────────────────────────

const features = [
  { icon: '👥', bg: 'bg-blue-50',    title: 'Group Management',   desc: 'Form groups, share invite codes, and manage members with built-in size limits.' },
  { icon: '📄', bg: 'bg-purple-50',  title: 'Proposal Workflow',  desc: 'Submit proposals, receive supervisor feedback, and track approval through version history.' },
  { icon: '✅', bg: 'bg-green-50',   title: 'Task Tracking',      desc: 'Break down your project into tasks, assign them to members, and track progress visually.' },
  { icon: '📁', bg: 'bg-yellow-50',  title: 'Document Repository',desc: 'Upload progress reports, final documents, and supporting files — all in one place.' },
  { icon: '💬', bg: 'bg-pink-50',    title: 'Group Messaging',    desc: 'Communicate directly with your supervisor and group in a dedicated message thread.' },
  { icon: '🏆', bg: 'bg-orange-50',  title: 'Fair Grading',       desc: 'Dual grading by both supervisor and examiner with a transparent rubric-based system.' },
]

const steps = [
  { title: 'Create or join a group',   desc: 'Use an invite code from your leader' },
  { title: 'Submit your proposal',     desc: 'Get supervisor approval before starting' },
  { title: 'Track your tasks',         desc: 'Assign work and monitor progress' },
  { title: 'Upload final report',      desc: 'Submit documents before the deadline' },
]
