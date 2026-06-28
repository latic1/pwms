'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import type { Role } from '@/types'

// ─── Nav config ──────────────────────────────────────────────────────────────

type NavItem = { label: string; href: string; icon: React.ReactNode }

const navItems: Record<Role, NavItem[]> = {
  student: [
    { label: 'Dashboard',  href: '/student',           icon: <IconGrid /> },
    { label: 'My Group',   href: '/student/group',     icon: <IconUsers /> },
    { label: 'Proposal',   href: '/student/proposal',  icon: <IconDoc /> },
    { label: 'Tasks',      href: '/student/tasks',     icon: <IconCheck /> },
    { label: 'Documents',  href: '/student/documents', icon: <IconFolder /> },
    { label: 'Messages',   href: '/student/messages',  icon: <IconChat /> },
  ],
  supervisor: [
    { label: 'Dashboard',  href: '/supervisor',          icon: <IconGrid /> },
    { label: 'Groups',     href: '/supervisor/groups',   icon: <IconUsers /> },
    { label: 'Meetings',   href: '/supervisor/meetings', icon: <IconCalendar /> },
    { label: 'Grading',    href: '/supervisor/grading',  icon: <IconStar /> },
  ],
  admin: [
    { label: 'Dashboard',        href: '/admin',                  icon: <IconGrid /> },
    { label: 'Users',            href: '/admin/users',            icon: <IconUsers /> },
    { label: 'Groups',           href: '/admin/groups',           icon: <IconFolder /> },
    { label: 'Academic Periods', href: '/admin/periods',          icon: <IconCalendar /> },
    { label: 'Announcements',    href: '/admin/announcements',    icon: <IconBell /> },
    { label: 'Audit Log',        href: '/admin/audit-log',        icon: <IconList /> },
  ],
  examiner: [
    { label: 'Dashboard',   href: '/examiner',             icon: <IconGrid /> },
    { label: 'Submissions', href: '/examiner/submissions', icon: <IconDoc /> },
  ],
}

const roleMeta: Record<Role, { label: string; accent: string; dot: string }> = {
  student:    { label: 'Student',    accent: 'text-blue-400',   dot: 'bg-blue-400' },
  supervisor: { label: 'Supervisor', accent: 'text-emerald-400',dot: 'bg-emerald-400' },
  admin:      { label: 'Admin',      accent: 'text-violet-400', dot: 'bg-violet-400' },
  examiner:   { label: 'Examiner',   accent: 'text-amber-400',  dot: 'bg-amber-400' },
}

const IS_DEV = process.env.NODE_ENV === 'development'

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, logout, setRole } = useAuth()
  const pathname = usePathname()
  const router   = useRouter()

  if (!user) return null

  const items  = navItems[user.role] ?? []
  const meta   = roleMeta[user.role]
  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  function handleRoleSwitch(r: Role) {
    setRole?.(r)
    router.push(navItems[r][0]?.href ?? '/')
  }

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-[#0f1117] text-white flex flex-col border-r border-white/[0.06]">

      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-none">FYP-WMS</p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-none">Project Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 px-2 mb-2">
          Navigation
        </p>
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                active
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span className={`shrink-0 transition-colors ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`}>
                {item.icon}
              </span>
              {item.label}
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Dev role switcher */}
      {IS_DEV && setRole && (
        <div className="px-3 pb-2">
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.07] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mb-2">
              Dev · Switch Role
            </p>
            <div className="grid grid-cols-2 gap-1">
              {(['student', 'supervisor', 'admin', 'examiner'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleSwitch(r)}
                  className={`text-[11px] px-2 py-1.5 rounded-md capitalize transition-all ${
                    user.role === r
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-white/[0.06] hover:bg-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* User profile */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.06] transition-colors group">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate leading-none mb-0.5">{user.name}</p>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
              <span className={`text-[11px] font-medium ${meta.accent}`}>{meta.label}</span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-white"
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function IconDoc() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function IconFolder() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  )
}

function IconList() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  )
}

function IconBell() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
    </svg>
  )
}
