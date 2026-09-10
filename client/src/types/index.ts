export type Role = 'student' | 'supervisor' | 'admin'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  // Student-specific (undefined for non-students)
  indexNumber?: string
  department?: string
  program?: string
  // Supervisor-specific — comma-separated keywords, feeds AI-assisted matching
  expertise?: string | null
  createdAt?: string
  mustChangePassword?: boolean
  isActive?: boolean
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
  panelId: string | null
  periodId: string | null
  resultApproved: boolean
  resultApprovedAt: string | null
  members: GroupMember[]
  supervisor: { id: string; name: string; email: string } | null
  panel: { id: string; name: string } | null
  createdAt: string
}

/** Lightweight group shape from list endpoints (no full members) */
export interface GroupSummary {
  id: string
  name: string
  inviteCode: string
  leaderId: string
  supervisorId: string | null
  panelId: string | null
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
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested'
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

export interface DocumentComment {
  id: string
  documentId: string
  authorId: string
  authorName: string
  authorRole: Role
  body: string
  createdAt: string
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
  graderRole: 'supervisor' | 'panel'
  score: number
  rubric: Record<string, number>
  feedback: string | null
  gradedAt: string
}

// ─── Panels ──────────────────────────────────────────────────────────────────

export interface Panel {
  id: string
  name: string
  createdAt: string
  members: { id: string; name: string; email: string }[]
  groups: { id: string; name: string; supervisorId: string | null }[]
}

/** A group shown on a panel member's grading list */
export interface MyPanelGroup {
  id: string
  name: string
  memberCount: number
  hasFinalReport: boolean
  myScore: number | null
  isOwnGroup: boolean
  proposalStatus: 'pending' | 'approved' | 'rejected' | 'changes_requested' | null
  proposalTitle: string | null
  hasSupervisorGrade: boolean
  panelGradeCount: number
  resultApproved: boolean
}

/** AI context shown to a panel while reviewing a proposal */
export interface AiReviewContext {
  topicHistory: {
    id: string
    studentName: string
    interests: string
    suggestions: TopicSuggestion[]
    createdAt: string
  }[]
  supervisorMatches: SupervisorMatch[]
  assignedSupervisorId: string | null
}

export interface MyPanel {
  id: string
  name: string
  groups: MyPanelGroup[]
}

export interface TopicSuggestion {
  title: string
  description: string
  keywords: string[]
}

export interface TopicSuggestionRecord {
  id: string
  interests: string
  suggestions: TopicSuggestion[]
  createdAt: string
}

export interface SupervisorMatch {
  supervisorId: string
  name: string
  email: string
  score: number
  matchedKeywords: string[]
  /** One-line AI-generated fit explanation; null if the AI step was unavailable. */
  reason?: string | null
}

export interface AcademicPeriod {
  id: string
  name: string
  groupDeadline: string
  proposalDeadline: string
  submissionDeadline: string
  gradesReleased: boolean
}

export interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}
