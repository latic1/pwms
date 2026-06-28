'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const STORAGE_KEY = 'fyp_onboarding_done'

// ─── Step data ────────────────────────────────────────────────────────────────

const steps = [
  {
    icon: '👋',
    title: 'Welcome to FYP-WMS',
    subtitle: 'Your Final Year Project workspace',
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>
          This system manages everything for your Final Year Project — from forming a
          group to submitting your final report and receiving your grade.
        </p>
        <p>Here's what you can do:</p>
        <ul className="space-y-1.5 pl-1">
          {[
            'Form or join a project group',
            'Submit and track your proposal',
            'Manage tasks and deadlines',
            'Upload documents and reports',
            'Communicate with your supervisor',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    icon: '👥',
    title: 'Step 1 — Form your group',
    subtitle: 'Every project starts with a group',
    content: (
      <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
        <p>You have two options:</p>
        <div className="grid gap-3">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <p className="font-semibold text-indigo-800 mb-1">Create a new group</p>
            <p className="text-indigo-700 text-xs">
              Go to <strong>My Group</strong>, enter a group name, and click Create.
              You become the group leader and get an invite code to share with teammates.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="font-semibold text-gray-800 mb-1">Join an existing group</p>
            <p className="text-xs">
              Ask your group leader for their invite code (e.g. <code className="bg-white px-1 rounded font-mono text-xs">ALPHA-7X2K</code>),
              then enter it on the My Group page to join.
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400">Groups are limited to 3 members maximum.</p>
      </div>
    ),
  },
  {
    icon: '📄',
    title: 'Step 2 — Submit your proposal',
    subtitle: 'Get supervisor approval to begin',
    content: (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>
          Before you can start working, your supervisor needs to approve your project proposal.
        </p>
        <div className="space-y-2">
          {[
            { n: '1', label: 'Go to the Proposal page' },
            { n: '2', label: 'Upload your proposal PDF' },
            { n: '3', label: 'Fill in the title and abstract' },
            { n: '4', label: 'Click Submit and wait for feedback' },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
              <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {s.n}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-800">
          <strong>Note:</strong> If rejected, your supervisor will leave comments. Update your proposal and resubmit — there's no limit on revisions.
        </div>
      </div>
    ),
  },
  {
    icon: '🎯',
    title: 'You\'re all set!',
    subtitle: 'Explore your dashboard',
    content: (
      <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
        <p>Your workspace is ready. Here's a quick map of the sidebar:</p>
        <div className="space-y-2">
          {[
            { icon: '📊', label: 'Dashboard',   desc: 'Overview of your project status' },
            { icon: '👥', label: 'My Group',     desc: 'Manage members and invite code' },
            { icon: '📄', label: 'Proposal',     desc: 'Submit and track your proposal' },
            { icon: '✅', label: 'Tasks',        desc: 'Your assigned work items' },
            { icon: '📁', label: 'Documents',    desc: 'Upload reports and files' },
            { icon: '💬', label: 'Messages',     desc: 'Chat with your supervisor' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
              <span className="text-base w-5 text-center">{item.icon}</span>
              <div>
                <span className="font-medium text-gray-800">{item.label}</span>
                <span className="text-gray-400 mx-1.5">—</span>
                <span className="text-gray-500 text-xs">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 pt-1">
          Need help? Visit the{' '}
          <a href="/how-it-works" target="_blank" className="text-indigo-600 hover:underline">
            How it works
          </a>{' '}
          guide anytime.
        </p>
      </div>
    ),
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const { user } = useAuth()
  const router   = useRouter()
  const [visible, setVisible] = useState(false)
  const [step,    setStep]    = useState(0)

  useEffect(() => {
    // Only show for students who haven't completed onboarding
    if (user?.role === 'student' && typeof window !== 'undefined') {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) setVisible(true)
    }
  }, [user])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function finish() {
    dismiss()
    router.push('/student/group')
  }

  if (!visible) return null

  const current  = steps[step]
  const isLast   = step === steps.length - 1
  const progress = ((step + 1) / steps.length) * 100

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-1 bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{current.icon}</span>
            <div>
              <h2 className="font-bold text-gray-900 text-lg leading-tight">{current.title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{current.subtitle}</p>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
            title="Skip setup"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">{current.content}</div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-5 h-2 bg-indigo-600'
                    : i < step
                    ? 'w-2 h-2 bg-indigo-300'
                    : 'w-2 h-2 bg-gray-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to My Group →
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
