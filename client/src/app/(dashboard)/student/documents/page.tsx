'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useDocuments } from '@/hooks/useDocuments'
import api, { API_BASE } from '@/lib/api'
import type { Document } from '@/types'

const typeStyles: Record<Document['type'], string> = {
  proposal:        'bg-blue-100 text-blue-700',
  progress_report: 'bg-purple-100 text-purple-700',
  final_report:    'bg-green-100 text-green-700',
  supporting:      'bg-gray-100 text-gray-600',
}

const typeLabels: Record<Document['type'], string> = {
  proposal:        'Proposal',
  progress_report: 'Progress Report',
  final_report:    'Final Report',
  supporting:      'Supporting',
}

const typeOptions = Object.keys(typeLabels) as Document['type'][]

function FileIcon({ type }: { type: Document['type'] }) {
  const colors: Record<Document['type'], string> = {
    proposal:        'text-blue-500',
    progress_report: 'text-purple-500',
    final_report:    'text-green-500',
    supporting:      'text-gray-400',
  }
  return (
    <svg className={`w-8 h-8 shrink-0 ${colors[type]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

export default function DocumentsPage() {
  const { user }  = useAuth()
  const { group } = useMyGroup()
  const { documents, mutate } = useDocuments(group?.id ?? null)

  const [filter,       setFilter]       = useState<Document['type'] | 'all'>('all')
  const [uploading,    setUploading]    = useState(false)
  const [selectedType, setSelectedType] = useState<Document['type']>('supporting')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadError,  setUploadError]  = useState('')
  const [uploading2,   setUploading2]   = useState(false)

  const isLeader = group?.leaderId === user?.id
  const filtered = filter === 'all' ? documents : documents.filter((d) => d.type === filter)

  // Only leader can upload final_report — filter type options accordingly
  const availableTypes = isLeader
    ? typeOptions
    : typeOptions.filter((t) => t !== 'final_report')

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile || !group) return
    setUploadError('')
    setUploading2(true)
    try {
      const form = new FormData()
      form.append('file', selectedFile)
      form.append('type', selectedType)
      await api.post(`/documents/${group.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await mutate()
      setUploading(false)
      setSelectedFile(null)
    } catch (err: any) {
      setUploadError(err?.response?.data?.error ?? 'Upload failed.')
    } finally {
      setUploading2(false)
    }
  }

  if (!group) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Documents</h1>
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 text-center">
          You must be in a group to access documents.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-1">Upload and manage your group's project files</p>
        </div>
        <button
          onClick={() => { setUploading(!uploading); setUploadError('') }}
          className="px-4 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors"
        >
          {uploading ? 'Cancel' : '+ Upload File'}
        </button>
      </div>

      {/* Upload form */}
      {uploading && (
        <div className="bg-white rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Upload New File</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as Document['type'])}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <p className="text-sm text-gray-700 font-medium">{selectedFile.name}</p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500">Click to select a file</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, PNG, ZIP up to 20MB</p>
                    </>
                  )}
                </label>
              </div>
            </div>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || uploading2}
                className="px-5 py-2 rounded-md bg-gray-900 text-white text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading2 ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {(['all', ...typeOptions] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === t
                ? 'bg-gray-900 text-white'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t === 'all' ? 'All' : typeLabels[t]}
            <span className="ml-1.5 opacity-60">
              {t === 'all' ? documents.length : documents.filter((d) => d.type === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No documents in this category.</div>
        ) : (
          filtered.map((doc) => {
            const uploader = group.members.find((m) => m.id === doc.uploaderId)
            return (
              <div key={doc.id} className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4">
                <FileIcon type={doc.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>Uploaded by {uploader?.name ?? 'Unknown'}</span>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${typeStyles[doc.type]}`}>
                  {typeLabels[doc.type]}
                </span>
                <a
                  href={`${API_BASE}${doc.fileUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Download
                </a>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
