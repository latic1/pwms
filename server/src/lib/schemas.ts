import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
})

export const resetPasswordSchema = z.object({
  token:       z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters').max(128),
})

// ─── Admin Users ──────────────────────────────────────────────────────────────

const ROLES = ['student', 'supervisor', 'admin', 'examiner'] as const

export const createUserSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100).trim(),
  email:       z.string().email('Invalid email address').max(254).trim().toLowerCase(),
  role:        z.enum(ROLES, { error: 'Invalid role' }),
  indexNumber: z.string().max(50).trim().optional(),
  department:  z.string().max(100).trim().optional(),
  program:     z.string().max(100).trim().optional(),
})

export const updateUserSchema = z.object({
  role: z.enum(ROLES, { error: 'Invalid role' }).optional(),
  name: z.string().min(1).max(100).trim().optional(),
})

// ─── Groups ───────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100).trim(),
})

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').max(20).trim().toUpperCase(),
})

// ─── Tasks ────────────────────────────────────────────────────────────────────

const TASK_STATUSES = ['pending', 'in_progress', 'under_review', 'done'] as const

export const createTaskSchema = z.object({
  title:      z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  dueDate:    z.string().datetime({ offset: true }).optional().or(z.string().date().optional()),
})

export const updateTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES, { error: 'Invalid task status' }),
})

// ─── Proposals ────────────────────────────────────────────────────────────────

export const reviewProposalSchema = z.object({
  status:            z.enum(['approved', 'rejected'], { error: 'Status must be approved or rejected' }),
  supervisorComment: z.string().max(2000).trim().optional(),
})

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const createMeetingSchema = z.object({
  scheduledAt: z.string().min(1, 'scheduledAt is required'),
  notes:       z.string().max(1000).trim().optional(),
})

// ─── Grades ───────────────────────────────────────────────────────────────────

export const submitGradeSchema = z.object({
  score:    z.number().int().min(0).max(100),
  rubric:   z.record(z.string(), z.number()).optional(),
  feedback: z.string().max(2000).trim().optional(),
})

// ─── Messages ────────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(5000).trim(),
})

// ─── Periods ─────────────────────────────────────────────────────────────────

export const createPeriodSchema = z.object({
  name:               z.string().min(1, 'Name is required').max(100).trim(),
  groupDeadline:      z.string().min(1, 'Group deadline is required'),
  proposalDeadline:   z.string().min(1, 'Proposal deadline is required'),
  submissionDeadline: z.string().min(1, 'Submission deadline is required'),
})
