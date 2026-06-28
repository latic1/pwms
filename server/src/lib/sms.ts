/**
 * SMS client for smsonlinegh.com personalized messaging API.
 * Variables in templates use the {$name} syntax.
 * Values for each destination must be ordered to match variable order in the template.
 */

const API_URL    = 'https://api.smsonlinegh.com/v5/message/sms/send'
const API_KEY    = process.env.SMS_API_KEY ?? ''
const SENDER     = process.env.SMS_SENDER  ?? ''

export interface SmsDestination {
  number: string
  values?: (string | number)[]
}

interface SmsPayload {
  text:         string
  type:         0
  sender:       string
  destinations: SmsDestination[]
}

/**
 * Send a personalised SMS to one or more destinations.
 * @param template  Message template with {$var} placeholders
 * @param destinations  Array of { number, values[] } — values order matches template variables
 */
export async function sendSms(
  template:     string,
  destinations: SmsDestination[]
): Promise<void> {
  if (!API_KEY || !SENDER) {
    console.warn('[SMS] SMS_API_KEY or SMS_SENDER not set — skipping SMS')
    return
  }

  // Drop destinations with no phone number
  const valid = destinations.filter((d) => d.number && d.number.trim().length >= 9)
  if (valid.length === 0) return

  const payload: SmsPayload = {
    text: template,
    type: 0,
    sender: SENDER,
    destinations: valid,
  }

  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': `key ${API_KEY}`,
        'Host':          'api.smsonlinegh.com',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[SMS] Request failed ${res.status}:`, body)
    }
  } catch (err) {
    // Never let SMS failures crash the main request
    console.error('[SMS] Network error:', err)
  }
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Notify a newly created user of their credentials. */
export function smsNewUser(phone: string, name: string, email: string, tempPassword: string) {
  return sendSms(
    'Hello {$name}. Your FYP-WMS account has been created. Email: {$email} | Temporary password: {$password}. Please log in and change your password.',
    [{ number: phone, values: [name, email, tempPassword] }]
  )
}

/** Notify group members of a proposal decision. */
export function smsProposalDecision(
  members: { phone: string; name: string }[],
  proposalTitle: string,
  status: 'approved' | 'rejected',
  comment?: string
) {
  const template = status === 'approved'
    ? 'Hello {$name}. Your group\'s proposal "{$title}" has been approved by your supervisor.'
    : 'Hello {$name}. Your group\'s proposal "{$title}" was rejected. Feedback: {$comment}. Please revise and resubmit.'

  const destinations: SmsDestination[] = members
    .filter((m) => m.phone)
    .map((m) => ({
      number: m.phone,
      values: status === 'approved'
        ? [m.name, proposalTitle]
        : [m.name, proposalTitle, comment ?? 'See system for details'],
    }))

  return sendSms(template, destinations)
}

/** Send a deadline reminder to a list of students. */
export function smsDeadlineReminder(
  members: { phone: string; name: string }[],
  deadlineType: string,
  dateLabel: string
) {
  return sendSms(
    'Hello {$name}. Reminder: Your FYP {$type} deadline is on {$date}. Please ensure all required submissions are completed on time.',
    members
      .filter((m) => m.phone)
      .map((m) => ({ number: m.phone, values: [m.name, deadlineType, dateLabel] }))
  )
}
