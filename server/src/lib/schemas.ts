import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email:    z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
  // Which sign-in page this came from — 'student' or 'staff' (supervisor +
  // admin). Optional so older/other callers keep working unchanged; when
  // present the server enforces it matches the account's actual role.
  channel:  z.enum(['student', 'staff']).optional(),
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

const ROLES = ['student', 'supervisor', 'admin'] as const

export const createUserSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100).trim(),
  email:       z.string().email('Invalid email address').max(254).trim().toLowerCase(),
  role:        z.enum(ROLES, { error: 'Invalid role' }),
  // Required for every role — password-reset codes are delivered by SMS, so a
  // phone number must be on file from the moment the account is created.
  phone:       z.string().min(9, 'Phone number is required').max(20).trim(),
  indexNumber: z.string().max(50).trim().optional(),
  department:  z.string().max(100).trim().optional(),
  program:     z.string().max(100).trim().optional(),
  // Comma-separated keywords, e.g. "machine learning, nlp, databases" — feeds
  // the AI-assisted student/supervisor topic matching.
  expertise:   z.string().max(500).trim().optional(),
}).superRefine((data, ctx) => {
  // Students need these to appear anywhere in the system (group rosters,
  // bulk import, reports) — enforce the same requirement here that the
  // single-registration form already enforces client-side, so bulk import
  // and single registration hold users to the same standard.
  if (data.role !== 'student') return
  if (!data.indexNumber) ctx.addIssue({ code: 'custom', path: ['indexNumber'], message: 'Index number is required for students' })
  if (!data.department)  ctx.addIssue({ code: 'custom', path: ['department'],  message: 'Faculty is required for students' })
  if (!data.program)     ctx.addIssue({ code: 'custom', path: ['program'],     message: 'Program is required for students' })
})

export const updateUserSchema = z.object({
  role:        z.enum(ROLES, { error: 'Invalid role' }).optional(),
  name:        z.string().min(1).max(100).trim().optional(),
  email:       z.string().email('Invalid email address').max(254).trim().toLowerCase().optional(),
  phone:       z.string().min(9, 'Phone number looks too short').max(20).trim().optional(),
  indexNumber: z.string().max(50).trim().optional(),
  department:  z.string().max(100).trim().optional(),
  program:     z.string().max(100).trim().optional(),
  expertise:   z.string().max(500).trim().optional(),
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
  status:            z.enum(['approved', 'rejected', 'changes_requested'], { error: 'Status must be approved, rejected, or changes_requested' }),
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

// ─── Panels ──────────────────────────────────────────────────────────────────

export const createPanelSchema = z.object({
  name:      z.string().min(1, 'Panel name is required').max(100).trim(),
  memberIds: z.array(z.string().uuid('Invalid member ID')).max(20).optional(),
})

export const updatePanelSchema = z.object({
  name:      z.string().min(1).max(100).trim().optional(),
  memberIds: z.array(z.string().uuid('Invalid member ID')).max(20).optional(),
})

export const assignPanelSchema = z.object({
  panelId: z.string().uuid('Invalid panel ID').nullable(),
})

// ─── Messages ────────────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(5000).trim(),
})

// ─── Document comments ────────────────────────────────────────────────────────

export const addDocumentCommentSchema = z.object({
  body: z.string().min(1, 'Comment cannot be empty').max(2000).trim(),
})

// ─── Push subscriptions ───────────────────────────────────────────────────────

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url('Invalid subscription endpoint'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
})

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url('Invalid subscription endpoint'),
})

// ─── Periods ─────────────────────────────────────────────────────────────────

export const createPeriodSchema = z.object({
  name:               z.string().min(1, 'Name is required').max(100).trim(),
  groupDeadline:      z.string().min(1, 'Group deadline is required'),
  proposalDeadline:   z.string().min(1, 'Proposal deadline is required'),
  submissionDeadline: z.string().min(1, 'Submission deadline is required'),
})

// ─── AI Suggestions ───────────────────────────────────────────────────────────

export const suggestTopicsSchema = z.object({
  interests: z.array(z.string().min(2).max(60).trim()).min(1, 'At least one interest is required').max(10),
})

export const matchSupervisorsSchema = z.object({
  topicTitle: z.string().min(2, 'Topic title is required').max(255).trim(),
  keywords:   z.array(z.string().min(2).max(60).trim()).max(10).optional(),
})

export const updateExpertiseSchema = z.object({
  expertise: z.string().max(500).trim(),
})
