import { query } from '../db'
import { smsDeadlineReminder } from './sms'

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

/** Returns dates that fall exactly N days from today (midnight-to-midnight comparison). */
function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
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
    const members = await query<{ name: string; phone: string | null }>(
      `SELECT DISTINCT u.name, u.phone
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = gm.user_id
       WHERE g.period_id = $1 AND u.phone IS NOT NULL`,
      [period.id]
    )

    if (members.length > 0) {
      await smsDeadlineReminder(
        members.map((m) => ({ name: m.name, phone: m.phone! })),
        'document submission',
        new Date(period.submission_deadline).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      )
      console.log(`[Reminder] Submission deadline SMS sent for period "${period.name}" to ${members.length} students`)
    }
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
    const members = await query<{ name: string; phone: string | null }>(
      `SELECT DISTINCT u.name, u.phone
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       JOIN users u ON u.id = gm.user_id
       WHERE g.period_id = $1
         AND u.phone IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM proposals p WHERE p.group_id = g.id
         )`,
      [period.id]
    )

    if (members.length > 0) {
      await smsDeadlineReminder(
        members.map((m) => ({ name: m.name, phone: m.phone! })),
        'proposal submission',
        new Date(period.proposal_deadline).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'long', year: 'numeric',
        })
      )
      console.log(`[Reminder] Proposal deadline SMS sent for period "${period.name}" to ${members.length} students`)
    }
  }
}

export function startDeadlineReminders() {
  // Run once on startup, then every 24 hours
  runCheck().catch((err) => console.error('[Reminder] Check failed:', err))
  setInterval(() => {
    runCheck().catch((err) => console.error('[Reminder] Check failed:', err))
  }, TWENTY_FOUR_HOURS)
}
