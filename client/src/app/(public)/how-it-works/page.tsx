'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─── Data ─────────────────────────────────────────────────────────────────────

const roles = [
  { id: 'student',    label: 'Student',    icon: '🎓', color: 'bg-blue-600' },
  { id: 'supervisor', label: 'Supervisor', icon: '👨‍🏫', color: 'bg-emerald-600' },
  { id: 'examiner',   label: 'Examiner',   icon: '🔍', color: 'bg-amber-600' },
  { id: 'admin',      label: 'Admin',      icon: '⚙️',  color: 'bg-violet-600' },
]

const walkthroughs: Record<string, { step: number; title: string; desc: string; tip?: string }[]> = {
  student: [
    { step: 1, title: 'Sign in',                  desc: 'Log in with your university email and password. You\'ll be taken to your student dashboard automatically.' },
    { step: 2, title: 'Create or join a group',    desc: 'Go to My Group. Either create a new group (you become the leader) or enter an invite code from a classmate to join their group. Groups are capped at 3 members.', tip: 'Only the group leader can see and share the invite code — ask your leader to send it to you.' },
    { step: 3, title: 'Submit your proposal',      desc: 'Navigate to Proposal. Upload your project proposal PDF and fill in the title and abstract. Your supervisor will approve or reject it with comments.', tip: 'You can resubmit as many times as needed until it\'s approved.' },
    { step: 4, title: 'Track tasks',               desc: 'Under Tasks, you\'ll see work items assigned to your group. Move them through Pending → In Progress → Under Review → Done as you complete them.' },
    { step: 5, title: 'Upload documents',          desc: 'Use the Documents page to upload progress reports, your final report, and any supporting files (max 20 MB each).' },
    { step: 6, title: 'Communicate',               desc: 'Use Messages to stay in contact with your supervisor and group. All messages are threaded by group for clarity.' },
    { step: 7, title: 'Submit final report',       desc: 'When your project is complete, the group leader uploads the final report. This triggers examiner grading.' },
  ],
  supervisor: [
    { step: 1, title: 'Sign in',                   desc: 'Log in with your faculty credentials to access your supervisor dashboard.' },
    { step: 2, title: 'View your groups',           desc: 'Your Groups page lists all groups assigned to you. Expand any group to see members, proposals, tasks, and documents.' },
    { step: 3, title: 'Review proposals',           desc: 'Pending proposals appear on your dashboard. Approve or reject each with written feedback. Rejected proposals can be resubmitted.' },
    { step: 4, title: 'Schedule meetings',          desc: 'Use the Meetings page to schedule check-ins. Confirm or mark meetings as completed after they happen.' },
    { step: 5, title: 'Assign and manage tasks',    desc: 'Create tasks for your groups from the group detail view. Assign them to specific members with due dates.' },
    { step: 6, title: 'Grade your groups',          desc: 'Under Grading, submit a score (0–100) and written feedback for each group you supervise. You can update your grade until grades are released by admin.' },
  ],
  examiner: [
    { step: 1, title: 'Sign in',                   desc: 'Log in with your faculty credentials to access the examiner portal.' },
    { step: 2, title: 'Browse submissions',         desc: 'The Submissions page lists all project groups. Click any group to see their submitted documents.' },
    { step: 3, title: 'Review documents',           desc: 'Download and review the final report, supporting materials, and any other files uploaded by the group.' },
    { step: 4, title: 'View supervisor\'s grade',  desc: 'The group detail page shows the supervisor\'s score and feedback so you can form an independent assessment.' },
    { step: 5, title: 'Submit your examination grade', desc: 'Fill in the rubric (problem definition, methodology, implementation, etc.) to arrive at a total score. Add written feedback and submit.', tip: 'Your grade is independent of the supervisor\'s. You can update it before admin releases grades.' },
  ],
  admin: [
    { step: 1, title: 'Sign in',                   desc: 'Log in as admin to access the full management dashboard.' },
    { step: 2, title: 'Manage academic periods',    desc: 'Create and configure academic periods (cohort years) with deadlines for group formation, proposals, and submissions. Release grades when ready.' },
    { step: 3, title: 'Register users',             desc: 'Add new students, supervisors, and examiners from the Users page. Set their initial passwords and roles.' },
    { step: 4, title: 'Manage groups',              desc: 'View all groups, assign supervisors, change group leaders, or remove members from the Groups page.' },
    { step: 5, title: 'Post announcements',         desc: 'Use the Announcements page to publish important dates and notices. They appear as banners on the public landing page.' },
    { step: 6, title: 'Monitor audit log',          desc: 'The Audit Log records every significant action in the system — group creation, proposal submissions, grade changes — for accountability.' },
  ],
}

const faqs = [
  {
    q: 'How many students can be in one group?',
    a: 'Groups are capped at 3 members. This is enforced by the system and cannot be changed without admin intervention.',
  },
  {
    q: 'Can I leave a group after joining?',
    a: 'Only the group leader can remove members. Contact your leader or the admin if you need to change groups.',
  },
  {
    q: 'What file types can I upload?',
    a: 'The system accepts PDF, Word (.doc/.docx), PowerPoint (.ppt/.pptx), ZIP archives, and PNG/JPEG images. Maximum file size is 20 MB.',
  },
  {
    q: 'When can students see their final grade?',
    a: 'Grades are only visible to students after the admin releases them for the academic period. Until then, the grades page will show "not yet released".',
  },
  {
    q: 'Can I resubmit my proposal if it\'s rejected?',
    a: 'Yes — you can resubmit as many times as needed. Each submission is a new version and the full history is kept.',
  },
  {
    q: 'Who can see my documents?',
    a: 'Your uploaded documents are visible to your group members, your supervisor, examiners, and admins. They are not public.',
  },
  {
    q: 'I forgot my password. What do I do?',
    a: 'Contact your system administrator. They can reset your password from the Users management page.',
  },
  {
    q: 'Can a group have more than one supervisor?',
    a: 'No — each group has exactly one assigned supervisor. Reassignment is done by admin.',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  const [activeRole, setActiveRole] = useState<string>('student')
  const [openFaq,    setOpenFaq]    = useState<number | null>(null)

  const steps = walkthroughs[activeRole] ?? []

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">How it works</h1>
        <p className="text-gray-500 mt-2 max-w-xl mx-auto">
          Step-by-step guides for every role. Pick yours below to get started.
        </p>
      </div>

      {/* Role selector */}
      <section>
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRole(r.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                activeRole === r.id
                  ? 'bg-gray-900 border-gray-900 text-white shadow-md'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900'
              }`}
            >
              <span>{r.icon}</span> I'm a {r.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-5 bottom-5 w-px bg-gray-200" />

          <div className="space-y-6">
            {steps.map((s, i) => (
              <div key={s.step} className="relative flex gap-5">
                {/* Circle */}
                <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                  i === 0 ? 'bg-indigo-600' : 'bg-gray-900'
                }`}>
                  {s.step}
                </div>
                {/* Content */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
                  {s.tip && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                      <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span><strong>Tip:</strong> {s.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video embed slots */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Video walkthroughs</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { title: 'Getting started as a student',   duration: '3 min' },
            { title: 'Submitting your proposal',        duration: '2 min' },
            { title: 'Supervisor\'s review workflow',  duration: '4 min' },
            { title: 'Grading and final submission',    duration: '3 min' },
          ].map((v) => (
            <div key={v.title} className="bg-white rounded-2xl border shadow-sm overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
              {/* Placeholder thumbnail */}
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-36 flex items-center justify-center relative">
                <div className="w-12 h-12 rounded-full bg-gray-900/80 flex items-center justify-center group-hover:bg-indigo-600 transition-colors">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="absolute bottom-2 right-3 text-xs text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                  {v.duration}
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm font-medium text-gray-800">{v.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">Coming soon</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently asked questions</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-medium text-gray-800">{faq.q}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 shrink-0 ml-3 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-indigo-50 rounded-2xl border border-indigo-100 p-8 text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to get started?</h3>
        <p className="text-sm text-gray-500 mb-5">Sign in with your university credentials and follow the steps above.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          Sign in now →
        </Link>
      </section>
    </div>
  )
}
