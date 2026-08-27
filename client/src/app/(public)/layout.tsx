'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/types'

const roleHome: Record<Role, string> = {
  student:    '/student',
  supervisor: '/supervisor',
  admin:      '/admin',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname  = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { label: 'Home',        href: '/' },
    { label: 'Projects',    href: '/projects' },
    { label: 'How it works',href: '/how-it-works' },
  ]

  // Close the mobile menu automatically on navigation. Adjusted during
  // render (comparing against the last-seen pathname) rather than in an
  // effect, per React's guidance for resetting state when a prop changes.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm truncate">FYP-WMS</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => {
              const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
          </nav>

          {/* Auth CTA */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {user ? (
              <Link
                href={roleHome[user.role] ?? '/login'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                  {user.name[0]}
                </span>
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Get started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
            className="sm:hidden shrink-0 p-2 -mr-2 text-gray-600 hover:text-gray-900"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu panel */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {navLinks.map((l) => {
              const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href)
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`block px-3 py-2 rounded-md text-sm ${
                    active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {l.label}
                </Link>
              )
            })}
            <div className="pt-2 mt-2 border-t border-gray-100 flex flex-col gap-2">
              {user ? (
                <Link
                  href={roleHome[user.role] ?? '/login'}
                  className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium text-center"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50 text-center">
                    Sign in
                  </Link>
                  <Link href="/login" className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium text-center">
                    Get started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <span className="font-medium text-gray-500">FYP Work Management System</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/projects" className="hover:text-gray-700 transition-colors">Projects</Link>
            <Link href="/how-it-works" className="hover:text-gray-700 transition-colors">How it works</Link>
            <Link href="/login" className="hover:text-gray-700 transition-colors">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
