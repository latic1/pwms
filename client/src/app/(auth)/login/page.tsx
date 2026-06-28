'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Role } from '@/types'
import { useAuth } from '@/lib/auth-context'

const demoAccounts: { email: string; role: Role; label: string }[] = [
  { email: 'alice@student.edu',  role: 'student',    label: 'Student (Leader)' },
  { email: 'james@faculty.edu',  role: 'supervisor', label: 'Supervisor' },
  { email: 'admin@uni.edu',      role: 'admin',      label: 'Admin' },
  { email: 'paul@faculty.edu',   role: 'examiner',   label: 'Examiner' },
]

const roleColors: Record<Role, string> = {
  student:    'bg-blue-600',
  supervisor: 'bg-green-600',
  admin:      'bg-purple-600',
  examiner:   'bg-orange-600',
}

export default function LoginPage() {
  const { login } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  function handleDemoFill(account: typeof demoAccounts[0]) {
    setEmail(account.email)
    setPassword('password')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email.trim().toLowerCase(), password)
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Logo / branding */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-900 mb-4">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">FYP Work Management</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
      </div>

      {/* Login card */}
      <div className="bg-white rounded-2xl border shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@university.edu"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          Accounts are created by your system administrator.
        </p>
      </div>

      {/* Demo accounts */}
      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Demo accounts — click to fill
        </p>
        <div className="grid grid-cols-2 gap-2">
          {demoAccounts.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => handleDemoFill(a)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${roleColors[a.role]}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700">{a.label}</p>
                <p className="text-xs text-gray-400 truncate">{a.email}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          Password for all: <code className="bg-gray-100 px-1 rounded">password</code>
        </p>
      </div>
    </div>
  )
}
