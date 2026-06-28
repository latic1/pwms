export type Role = 'student' | 'supervisor' | 'admin' | 'examiner'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  // Student-specific (undefined for non-students)
  indexNumber?: string
  department?: string
  program?: string
  createdAt?: string
}

export interface GroupMember {
  id: string
  name: string
  email: string
  role: string
  indexNumber?: string | null
  department?: string | null
  program?: string | null
}

export interface Group {
  id: string
  name: string
  inviteCode: string
  leaderId: string
  supervisorId: string | null
  periodId: string | null
  members: GroupMember[]
  supervisor: { id: string; name: string; email: string } | null
  createdAt: string
}

/** Lightweight group shape from list endpoints (no full members) */
export interface GroupSummary {
  id: string
  name: string
  inviteCode: string
  leaderId: string
  supervisorId: string | null
  periodId: string | null
  createdAt: string
  memberCount: number
}

export interface Proposal {
  id: string
  groupId: string
  title: string
  abstract: string
  fileUrl: string
  status: 'pending' | 'approved' | 'rejected'
  version: number
  supervisorComment?: string
  submittedAt: string
}

export interface Task {
  id: string
  groupId: string
  title: string
  description: string
  assigneeId: string
  status: 'pending' | 'in_progress' | 'under_review' | 'done'
  dueDate: string
  createdBy: string
}

export interface Document {
  id: string
  groupId: string
  uploaderId: string
  fileName: string
  fileUrl: string
  type: 'proposal' | 'progress_report' | 'final_report' | 'supporting'
  uploadedAt: string
}

export interface Message {
  id: string
  groupId: string
  senderId: string
  senderName: string
  senderRole: Role
  body: string
  sentAt: string
}

export interface Meeting {
  id: string
  groupId: string
  supervisorId: string
  scheduledAt: string
  status: 'proposed' | 'confirmed' | 'completed'
  notes?: string
}

export interface Grade {
  id: string
  groupId: string
  graderId: string
  graderRole: 'supervisor' | 'examiner'
  score: number
  rubric: Record<string, number>
  feedback: string | null
  gradedAt: string
}

export interface AcademicPeriod {
  id: string
  name: string
  groupDeadline: string
  proposalDeadline: string
  submissionDeadline: string
  gradesReleased: boolean
}
