'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import api from '@/lib/api'
import { getLoginPath } from '@/lib/loginPath'

export default function ForcedChangePasswordPage() {
  const { user, loading, refreshUser, logout } = useAuth()
  const router = useRouter()

  const [current, setCurrent] = useState('')
  const [next,    setNext]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy,    setBusy]    = useState(false)
  const [error,   setError]   = useState('')

  // Not logged in → send to login. Already changed → send into the app.
  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace(getLoginPath())
    } else if (!user.mustChangePassword) {
      router.replace('/')
    }
  }, [user, loading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (next !== confirm) {
      setError('New passwords do not match.')
      return
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next === current) {
      setError('New password must be different from your current password.')
      return
    }

    setBusy(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: current,
        newPassword:     next,
      })
      await refreshUser()
      router.replace('/')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to change password.')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !user || !user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gray-900 mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
          <p className="text-sm text-gray-500 mt-1">
            You're signed in with a temporary password. Choose a new one to continue.
          </p>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current (temporary) password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="The password you logged in with"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter new password"
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
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? 'Saving...' : 'Set new password & continue'}
            </button>
          </form>

          <button
            onClick={logout}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}
