'use client'

import { useState, useRef } from 'react'
import { useUsers } from '@/hooks/useUsers'
import api from '@/lib/api'
import type { User, Role } from '@/types'

const roleStyles: Record<Role, string> = {
  student:    'bg-blue-100 text-blue-700',
  supervisor: 'bg-green-100 text-green-700',
  admin:      'bg-purple-100 text-purple-700',
  examiner:   'bg-orange-100 text-orange-700',
}

const roles: Role[] = ['student', 'supervisor', 'admin', 'examiner']

interface Credentials { name: string; email: string; tempPassword: string }

function CredentialsCard({ creds, onDismiss }: { creds: Credentials; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  const text = `Name: ${creds.name}\nEmail: ${creds.email}\nTemporary password: ${creds.tempPassword}\n\nPlease log in and change your password.`

  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Account created — share these credentials</p>
          <p className="text-xs text-emerald-600 mt-0.5">This password will not be shown again.</p>
        </div>
        <button onClick={onDismiss} className="text-emerald-400 hover:text-emerald-600 text-lg leading-none">×</button>
      </div>
      <div className="bg-white rounded-lg border border-emerald-200 divide-y divide-emerald-100 text-sm font-mono">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-gray-500 text-xs font-sans">Name</span>
          <span className="text-gray-800">{creds.name}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-gray-500 text-xs font-sans">Email</span>
          <span className="text-gray-800">{creds.email}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-gray-500 text-xs font-sans">Temp password</span>
          <span className="text-gray-800 font-bold tracking-wider">{creds.tempPassword}</span>
        </div>
      </div>
      <button
        onClick={copy}
        className="w-full py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
      >
        {copied ? '✓ Copied to clipboard' : 'Copy credentials'}
      </button>
    </div>
  )
}

// ─── Bulk import ─────────────────────────────────────────────────────────────

interface BulkCreated {
  id: string; name: string; email: string
  indexNumber: string | null; department: string | null
  tempPassword: string
}
interface BulkSkipped { row: number; email: string; reason: string }
interface BulkResult {
  summary: { total: number; created: number; skipped: number }
  created: BulkCreated[]
  skipped: BulkSkipped[]
}

function BulkImportPanel({ onDone }: { onDone: () => void }) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [file,    setFile]    = useState<File | null>(null)
  const [result,  setResult]  = useState<BulkResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [copied,  setCopied]  = useState(false)

  function downloadTemplate() {
    const csv = 'name,email,phone,indexNumber,department,program\nJane Doe,jane@uni.edu,0246314915,CS/2024/001,Computer Science,BSc Computer Science\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'students_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleUpload() {
    if (!file) return
    setError(''); setLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post<BulkResult>('/admin/users/bulk', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(res.data)
      onDone()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Import failed.')
    } finally {
      setLoading(false)
    }
  }

  function copyAllCredentials() {
    if (!result) return
    const text = result.created
      .map((u) => `${u.name} | ${u.email} | ${u.tempPassword}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (result) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Total rows',    value: result.summary.total,   color: 'text-gray-800' },
            { label: 'Created',       value: result.summary.created, color: 'text-emerald-600' },
            { label: 'Skipped',       value: result.summary.skipped, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-gray-50 border py-3">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Created credentials */}
        {result.created.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                Created accounts — share these credentials
              </p>
              <button
                onClick={copyAllCredentials}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                {copied ? '✓ Copied all' : 'Copy all'}
              </button>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Name</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Index No.</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Temp Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.created.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800 font-medium">{u.name}</td>
                      <td className="px-3 py-2 text-gray-500">{u.email}</td>
                      <td className="px-3 py-2 text-gray-500">{u.indexNumber ?? '—'}</td>
                      <td className="px-3 py-2 font-mono font-bold text-gray-900">{u.tempPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Skipped rows */}
        {result.skipped.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Skipped rows</p>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-red-50 border-b">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Row</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Email</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.skipped.map((s, i) => (
                    <tr key={i} className="hover:bg-red-50">
                      <td className="px-3 py-2 text-gray-500">{s.row}</td>
                      <td className="px-3 py-2 text-gray-800">{s.email}</td>
                      <td className="px-3 py-2 text-red-600">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          onClick={() => { setResult(null); setFile(null) }}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ← Import another file
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">Bulk import students</h2>
          <p className="text-xs text-gray-400 mt-0.5">Upload an Excel (.xlsx) or CSV file — max 200 rows.</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download template
        </button>
      </div>

      {/* Required columns hint */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700 space-y-1">
        <p className="font-semibold">Required columns:</p>
        <p><code className="bg-white/70 px-1 rounded">name</code>, <code className="bg-white/70 px-1 rounded">email</code></p>
        <p className="text-blue-500">Optional: <code className="bg-white/70 px-1 rounded">phone</code>, <code className="bg-white/70 px-1 rounded">indexNumber</code>, <code className="bg-white/70 px-1 rounded">department</code>, <code className="bg-white/70 px-1 rounded">program</code></p>
        <p className="text-blue-500">Column names are case-insensitive. All imported users are created as <strong>students</strong>.</p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          file ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-2xl">📄</p>
            <p className="text-sm font-medium text-indigo-700">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB — click to change</p>
          </div>
        ) : (
          <div className="space-y-1 text-gray-400">
            <p className="text-3xl">📂</p>
            <p className="text-sm font-medium">Click to select file</p>
            <p className="text-xs">.xlsx, .xls, or .csv</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        <button
          disabled={!file || loading}
          onClick={handleUpload}
          className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Importing...' : 'Import students'}
        </button>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { users, mutate } = useUsers()

  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState<Role | 'all'>('all')
  const [showForm,    setShowForm]    = useState(false)
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [formError,   setFormError]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [newCreds,    setNewCreds]    = useState<Credentials | null>(null)
  const [resetCreds,  setResetCreds]  = useState<Credentials | null>(null)
  const [showBulk,    setShowBulk]    = useState(false)

  // Form state
  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [phone,       setPhone]       = useState('')
  const [role,        setRole]        = useState<Role>('student')
  const [indexNumber, setIndexNumber] = useState('')
  const [department,  setDepartment]  = useState('')
  const [program,     setProgram]     = useState('')

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.indexNumber ?? '').toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  function openForm() {
    setName(''); setEmail(''); setPhone(''); setRole('student')
    setIndexNumber(''); setDepartment(''); setProgram('')
    setFormError(''); setNewCreds(null)
    setShowForm(true)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const res = await api.post('/admin/users', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role,
        ...(role === 'student' && {
          indexNumber: indexNumber.trim(),
          department:  department.trim(),
          program:     program.trim(),
        }),
      })
      await mutate()
      setNewCreds({ name: res.data.name, email: res.data.email, tempPassword: res.data.tempPassword })
      setShowForm(false)
    } catch (err: any) {
      setFormError(err?.response?.data?.error ?? 'Failed to register user.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: Role) {
    try {
      await api.patch(`/admin/users/${userId}`, { role: newRole })
      await mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to update role.')
    } finally {
      setEditingId(null)
    }
  }

  async function handleResetPassword(u: User) {
    if (!confirm(`Reset password for ${u.name}? A new temporary password will be generated.`)) return
    try {
      const res = await api.post(`/admin/users/${u.id}/reset-password`)
      setResetCreds({ name: u.name, email: u.email, tempPassword: res.data.tempPassword })
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to reset password.')
    }
  }

  async function handleRemove(u: User) {
    if (!confirm(`Remove ${u.name}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      mutate()
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Failed to remove user.')
    }
  }

  const counts: Record<Role | 'all', number> = {
    all:        users.length,
    student:    users.filter((u) => u.role === 'student').length,
    supervisor: users.filter((u) => u.role === 'supervisor').length,
    admin:      users.filter((u) => u.role === 'admin').length,
    examiner:   users.filter((u) => u.role === 'examiner').length,
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Register and manage system users</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowBulk(!showBulk); setShowForm(false) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showBulk ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Bulk import
          </button>
          {!showForm && !showBulk && (
            <button
              onClick={openForm}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Register user
            </button>
          )}
        </div>
      </div>

      {/* Bulk import panel */}
      {showBulk && (
        <BulkImportPanel onDone={() => mutate()} />
      )}

      {/* New credentials card */}
      {newCreds && <CredentialsCard creds={newCreds} onDismiss={() => setNewCreds(null)} />}

      {/* Reset credentials card */}
      {resetCreds && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Password reset for {resetCreds.name}</p>
          <CredentialsCard creds={resetCreds} onDismiss={() => setResetCreds(null)} />
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Register new user</h2>
            <p className="text-xs text-gray-400">A temporary password will be generated automatically.</p>
          </div>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Jane Doe"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g. jane@uni.edu"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Phone number <span className="text-gray-400 font-normal">(optional — for SMS notifications)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0246314915"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
              <div className="flex gap-2 flex-wrap">
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm capitalize font-medium transition-colors ${
                      role === r
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {role === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Index Number</label>
                  <input
                    value={indexNumber}
                    onChange={(e) => setIndexNumber(e.target.value)}
                    required
                    placeholder="e.g. CS/2024/001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    placeholder="e.g. Computer Science"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Program</label>
                  <input
                    value={program}
                    onChange={(e) => setProgram(e.target.value)}
                    required
                    placeholder="e.g. BSc Computer Science"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or index number..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex gap-1 flex-wrap">
          {(['all', ...roles] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                roleFilter === r ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r} <span className="ml-1 opacity-60">{counts[r]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left px-5 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell">Index / Dept</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">No users found.</td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    {u.indexNumber ? (
                      <div>
                        <p className="text-xs font-medium text-gray-700">{u.indexNumber}</p>
                        <p className="text-xs text-gray-400">{u.department}</p>
                      </div>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {editingId === u.id ? (
                      <select
                        defaultValue={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                        onBlur={() => setEditingId(null)}
                        autoFocus
                        className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none bg-white"
                      >
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span
                        onClick={() => setEditingId(u.id)}
                        title="Click to change role"
                        className={`cursor-pointer text-xs px-2.5 py-1 rounded-full font-medium capitalize hover:opacity-80 ${roleStyles[u.role as Role]}`}
                      >
                        {u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleResetPassword(u)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors whitespace-nowrap"
                      >
                        Reset password
                      </button>
                      <button
                        onClick={() => handleRemove(u)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
