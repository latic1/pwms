import { query } from '../db'
import { smsDeadlineReminder } from './sms'
import { emailDeadlineReminder } from './email'
import { notify, notifyMany, getAdminIds } from './notify'

interface ReminderMember {
  id:    string
  name:  string
  email: string
  phone: string | null
}

/** Send a deadline reminder over every channel: email + in-app to all, SMS to those with a phone. */
async function notifyMembers(members: ReminderMember[], deadlineType: string, dateLabel: string) {
  await Promise.all([
    smsDeadlineReminder(
      members.filter((m) => m.phone).map((m) => ({ name: m.name, phone: m.phone! })),
      deadlineType,
      dateLabel
    ),
    emailDeadlineReminder(
      members.map((m) => ({ name: m.name, email: m.email })),
      deadlineType,
      dateLabel
    ),
    notifyMany(
      members.map((m) => m.id),
      'deadline.reminder',
      `Deadline approaching: ${deadlineType}`,
      `Due ${dateLabel}.`,
      '/student'
    ),
  ])
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

/** Returns dates that fall exactly N days from today (midnight-to-midnight comparison). */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function runCheck() {
  const sevenDays  = daysFromNow(7)
  const threeDays  = daysFromNow(3)

  // Periods whose submission deadline is exactly 7 days away
  const submissionPeriods = await query<{ id: string; name: string; submission_deadline: string }>(
    `SELECT id, name, submission_deadline
     FROM academic_periods
     WHERE submission_deadline::date = $1::date`,
    [sevenDays]
  )

  for (const period of submissionPeriods) {
    const members = await query<ReminderMember>(
      `SELECT DISTINCT u.id, u.name, u.email, u.phone
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = gm.user_id
       WHERE g.period_id = $1`,
      [period.id]
    )

    if (members.length > 0) {
      await notifyMembers(
        members,
        'document submission',
        formatDate(period.submission_deadline)
      )
      console.log(`[Reminder] Submission deadline reminder sent for period "${period.name}" to ${members.length} students`)
    }

    // Supervisors who haven't graded a group in this period yet — same
    // 7-day heads-up window students get for submitting.
    const ungraded = await query<{ supervisor_id: string; group_name: string }>(
      `SELECT g.supervisor_id, g.name AS group_name
       FROM groups g
       WHERE g.period_id = $1
         AND g.supervisor_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM grades gr WHERE gr.group_id = g.id AND gr.grader_role = 'supervisor')`,
      [period.id]
    )
    for (const row of ungraded) {
      await notify(
        row.supervisor_id,
        'grading.deadline_approaching',
        'Grading deadline approaching',
        `"${row.group_name}" still needs a grade before ${formatDate(period.submission_deadline)}.`,
        '/supervisor/grading'
      )
    }

    // Admin heads-up on the same deadline
    await notifyMany(
      await getAdminIds(),
      'deadline.reminder',
      `Submission deadline approaching: ${period.name}`,
      `Final submission is due ${formatDate(period.submission_deadline)}.`,
      '/admin/periods'
    )
  }

  // Periods whose proposal deadline is exactly 3 days away
  const proposalPeriods = await query<{ id: string; name: string; proposal_deadline: string }>(
    `SELECT id, name, proposal_deadline
     FROM academic_periods
     WHERE proposal_deadline::date = $1::date`,
    [threeDays]
  )

  for (const period of proposalPeriods) {
    // Only notify groups that haven't submitted a proposal yet
    const members = await query<ReminderMember>(
      `SELECT DISTINCT u.id, u.name, u.email, u.phone
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = gm.user_id
       WHERE g.period_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM proposals p WHERE p.group_id = g.id
         )`,
      [period.id]
    )

    if (members.length > 0) {
      await notifyMembers(
        members,
        'proposal submission',
        formatDate(period.proposal_deadline)
      )
      console.log(`[Reminder] Proposal deadline reminder sent for period "${period.name}" to ${members.length} students`)
    }

    await notifyMany(
      await getAdminIds(),
      'deadline.reminder',
      `Proposal deadline approaching: ${period.name}`,
      `Proposal submission is due ${formatDate(period.proposal_deadline)}.`,
      '/admin/periods'
    )
  }

  // Periods whose group-formation deadline is exactly 3 days away (admin only)
  const groupPeriods = await query<{ id: string; name: string; group_deadline: string }>(
    `SELECT id, name, group_deadline FROM academic_periods WHERE group_deadline::date = $1::date`,
    [threeDays]
  )
  for (const period of groupPeriods) {
    await notifyMany(
      await getAdminIds(),
      'deadline.reminder',
      `Group formation deadline approaching: ${period.name}`,
      `Group formation closes ${formatDate(period.group_deadline)}.`,
      '/admin/periods'
    )
  }

  await runAdminDigest()
}

/** Daily backlog summary for admins — pending proposals and groups without a supervisor. */
async function runAdminDigest() {
  const adminIds = await getAdminIds()
  if (adminIds.length === 0) return

  const [pendingProposals] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM proposals p
     WHERE p.status = 'pending'
       AND p.version = (SELECT MAX(version) FROM proposals WHERE group_id = p.group_id)`
  )
  const pendingCount = parseInt(pendingProposals?.count ?? '0')
  if (pendingCount > 0) {
    await notifyMany(
      adminIds,
      'digest.proposals_pending',
      `${pendingCount} project topic${pendingCount !== 1 ? 's are' : ' is'} awaiting review`,
      null,
      '/admin/groups'
    )
  }

  const [unassigned] = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM groups WHERE supervisor_id IS NULL`
  )
  const unassignedCount = parseInt(unassigned?.count ?? '0')
  if (unassignedCount > 0) {
    await notifyMany(
      adminIds,
      'digest.supervisor_unassigned',
      `${unassignedCount} group${unassignedCount !== 1 ? 's' : ''} waiting for a supervisor assignment`,
      null,
      '/admin/groups'
    )
  }
}

export function startDeadlineReminders() {
  // Run once on startup, then every 24 hours
  runCheck().catch((err) => console.error('[Reminder] Check failed:', err))
  setInterval(() => {
    runCheck().catch((err) => console.error('[Reminder] Check failed:', err))
  }, TWENTY_FOUR_HOURS)
}
