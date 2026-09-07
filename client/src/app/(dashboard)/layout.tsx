'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { useAuth } from '@/lib/auth-context'
import { getLoginPath } from '@/lib/loginPath'

// Derive a readable page title from the pathname
function usePageTitle(): string {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Last meaningful segment, prettified
  const last = segments[segments.length - 1] ?? ''

  // Handle dynamic segments like UUIDs — show parent instead
  const isUUID = /^[0-9a-f-]{36}$/i.test(last)
  const segment = isUUID ? segments[segments.length - 2] ?? '' : last

  const labels: Record<string, string> = {
    student:    'Dashboard',
    supervisor: 'Dashboard',
    admin:      'Dashboard',
    group:      'My Group',
    proposal:   'Proposal',
    tasks:      'Tasks',
    documents:  'Documents',
    messages:   'Messages',
    groups:     'Groups',
    meetings:   'Meetings',
    grading:    'Grading',
    users:      'Users',
    periods:    'Academic Periods',
    'audit-log':     'Audit Log',
    'announcements': 'Announcements',
    submissions:     'Submissions',
    panels:          'Panels',
    panel:           'Panel Duty',
  }

  return labels[segment] ?? segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth()
  const title = usePageTitle()

  const now = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="md:hidden shrink-0 -ml-1 p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-gray-800 truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-gray-400 hidden lg:block">{now}</span>
        <NotificationBell />
        {user && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">{user.name}</span>
          </div>
        )}
      </div>
    </header>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close the mobile drawer automatically on navigation. Adjusted during
  // render (comparing against the last-seen pathname) rather than in an
  // effect, per React's guidance for resetting state when a prop changes.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMobileNavOpen(false)
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(getLoginPath())
    } else if (user.mustChangePassword) {
      router.replace('/change-password')
    }
  }, [user, loading, router])

  if (loading || user?.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
