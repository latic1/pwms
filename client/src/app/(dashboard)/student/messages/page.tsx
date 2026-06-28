'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useMyGroup } from '@/hooks/useGroup'
import { useMessages } from '@/hooks/useMessages'
import api from '@/lib/api'
import type { Message } from '@/types'

function Avatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase()
  const color =
    role === 'supervisor'
      ? 'bg-green-600 text-white'
      : role === 'student'
      ? 'bg-blue-600 text-white'
      : 'bg-gray-600 text-white'
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 ${color}`}>
      {initials}
    </span>
  )
}

export default function MessagesPage() {
  const { user }  = useAuth()
  const { group } = useMyGroup()
  const { messages, mutate } = useMessages(group?.id ?? null)

  const [input,    setInput]    = useState('')
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || !group) return
    setSending(true)
    try {
      await api.post(`/messages/${group.id}`, { body: trimmed })
      setInput('')
      mutate()
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = []
  for (const msg of messages) {
    const date = formatDate(msg.sentAt)
    const last = grouped[grouped.length - 1]
    if (last && last.date === date) {
      last.messages.push(msg)
    } else {
      grouped.push({ date, messages: [msg] })
    }
  }

  if (!group) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Messages</h1>
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 text-center">
          You must be in a group to access messages.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="bg-white rounded-t-xl border border-b-0 shadow-sm px-5 py-4 flex items-center gap-3">
        {group.supervisor && <Avatar name={group.supervisor.name} role="supervisor" />}
        <div>
          <p className="text-sm font-semibold text-gray-800">{group.name}</p>
          <p className="text-xs text-gray-400">
            {group.members.length} member{group.members.length !== 1 ? 's' : ''} ·{' '}
            Supervisor: {group.supervisor?.name ?? 'Unassigned'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-white border-x overflow-y-auto px-5 py-4 space-y-6">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello!</p>
        )}
        {grouped.map((group) => (
          <div key={group.date}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400 shrink-0">{group.date}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-4">
              {group.messages.map((msg) => {
                const isMe = msg.senderId === user?.id
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && <Avatar name={msg.senderName} role={msg.senderRole} />}
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMe && (
                        <span className="text-xs text-gray-500 font-medium">{msg.senderName}</span>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isMe
                            ? 'bg-gray-900 text-white rounded-tr-sm'
                            : msg.senderRole === 'supervisor'
                            ? 'bg-green-50 border border-green-100 text-gray-800 rounded-tl-sm'
                            : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                        }`}
                      >
                        {msg.body}
                      </div>
                      <span className="text-xs text-gray-400">{formatTime(msg.sentAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="bg-white rounded-b-xl border border-t shadow-sm px-4 py-3 flex items-center gap-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  )
}
