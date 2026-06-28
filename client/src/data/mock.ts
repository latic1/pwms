import type { User, Group, Proposal, Task, Document, Message, Meeting, AcademicPeriod } from '@/types'

export const mockUsers: User[] = [
  { id: 'u1', name: 'Alice Johnson', email: 'alice@student.edu', role: 'student', indexNumber: 'CS/2021/001', department: 'Computer Science', program: 'BSc Computer Science' },
  { id: 'u2', name: 'Bob Smith',     email: 'bob@student.edu',   role: 'student', indexNumber: 'CS/2021/002', department: 'Computer Science', program: 'BSc Computer Science' },
  { id: 'u3', name: 'Carol White',   email: 'carol@student.edu', role: 'student', indexNumber: 'IT/2021/015', department: 'Information Technology', program: 'BSc Information Technology' },
  { id: 'u4', name: 'Dr. James Okafor', email: 'james@faculty.edu', role: 'supervisor' },
  { id: 'u5', name: 'Prof. Linda Tan',  email: 'linda@faculty.edu', role: 'supervisor' },
  { id: 'u6', name: 'Admin User',       email: 'admin@uni.edu',     role: 'admin' },
  { id: 'u7', name: 'Dr. Paul Examiner',email: 'paul@faculty.edu',  role: 'examiner' },
]

export const mockCurrentUser: Record<string, User> = {
  student: mockUsers[0],
  supervisor: mockUsers[3],
  admin: mockUsers[5],
  examiner: mockUsers[6],
}

export const mockGroup: Group = {
  id: 'g1',
  name: 'Team Alpha',
  inviteCode: 'ALPHA-7X2K',
  leaderId: 'u1',
  supervisorId: 'u4',
  members: [mockUsers[0], mockUsers[1], mockUsers[2]],
  createdAt: '2025-01-15T10:00:00Z',
}

export const mockProposal: Proposal = {
  id: 'p1',
  groupId: 'g1',
  title: 'FYP Work Management System',
  abstract:
    'A web-based system to manage final year projects including group formation, proposal submission, task tracking, and grading.',
  fileUrl: '/files/proposal-v2.pdf',
  status: 'pending',
  version: 2,
  supervisorComment: 'Please add more detail to the methodology section.',
  submittedAt: '2025-02-01T09:30:00Z',
}

export const mockTasks: Task[] = [
  {
    id: 't1',
    groupId: 'g1',
    title: 'Set up project repository',
    description: 'Initialize GitHub repo with folder structure and README.',
    assigneeId: 'u1',
    status: 'done',
    dueDate: '2025-02-10',
    createdBy: 'u1',
  },
  {
    id: 't2',
    groupId: 'g1',
    title: 'Design database schema',
    description: 'Draft ER diagram covering all entities.',
    assigneeId: 'u2',
    status: 'in_progress',
    dueDate: '2025-02-20',
    createdBy: 'u4',
  },
  {
    id: 't3',
    groupId: 'g1',
    title: 'Write literature review',
    description: 'Survey at least 10 related systems and summarize findings.',
    assigneeId: 'u3',
    status: 'pending',
    dueDate: '2025-02-25',
    createdBy: 'u4',
  },
  {
    id: 't4',
    groupId: 'g1',
    title: 'Build authentication module',
    description: 'Implement login and role-based routing.',
    assigneeId: 'u1',
    status: 'under_review',
    dueDate: '2025-03-05',
    createdBy: 'u1',
  },
]

export const mockDocuments: Document[] = [
  {
    id: 'd1',
    groupId: 'g1',
    uploaderId: 'u1',
    fileName: 'proposal-v2.pdf',
    fileUrl: '/files/proposal-v2.pdf',
    type: 'proposal',
    uploadedAt: '2025-02-01T09:30:00Z',
  },
  {
    id: 'd2',
    groupId: 'g1',
    uploaderId: 'u2',
    fileName: 'er-diagram.png',
    fileUrl: '/files/er-diagram.png',
    type: 'supporting',
    uploadedAt: '2025-02-18T14:00:00Z',
  },
  {
    id: 'd3',
    groupId: 'g1',
    uploaderId: 'u3',
    fileName: 'progress-report-1.pdf',
    fileUrl: '/files/progress-report-1.pdf',
    type: 'progress_report',
    uploadedAt: '2025-03-01T11:00:00Z',
  },
]

export const mockMessages: Message[] = [
  {
    id: 'm1',
    groupId: 'g1',
    senderId: 'u4',
    senderName: 'Dr. James Okafor',
    senderRole: 'supervisor',
    body: 'Please update me on the current progress of the database schema.',
    sentAt: '2025-02-19T10:00:00Z',
  },
  {
    id: 'm2',
    groupId: 'g1',
    senderId: 'u2',
    senderName: 'Bob Smith',
    senderRole: 'student',
    body: 'We have completed the ER diagram. Uploading it now.',
    sentAt: '2025-02-19T10:30:00Z',
  },
  {
    id: 'm3',
    groupId: 'g1',
    senderId: 'u4',
    senderName: 'Dr. James Okafor',
    senderRole: 'supervisor',
    body: 'Good. Make sure to include the AuditLog table as discussed.',
    sentAt: '2025-02-19T10:45:00Z',
  },
]

export const mockMeetings: Meeting[] = [
  {
    id: 'mt1',
    groupId: 'g1',
    supervisorId: 'u4',
    scheduledAt: '2025-02-22T14:00:00Z',
    status: 'completed',
    notes: 'Discussed proposal feedback. Team to revise methodology section.',
  },
  {
    id: 'mt2',
    groupId: 'g1',
    supervisorId: 'u4',
    scheduledAt: '2025-03-10T14:00:00Z',
    status: 'confirmed',
  },
]

export const mockAcademicPeriod: AcademicPeriod = {
  id: 'ap1',
  name: 'Academic Year 2024/2025',
  groupDeadline: '2025-01-31',
  proposalDeadline: '2025-02-15',
  submissionDeadline: '2025-05-30',
  gradesReleased: false,
}
