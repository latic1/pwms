/**
 * Email client using Gmail SMTP (nodemailer).
 * Requires GMAIL_USER + GMAIL_APP_PASSWORD (a Google "App Password", not the
 * account password — generate one at https://myaccount.google.com/apppasswords,
 * which requires 2-Step Verification to be enabled).
 * Never throws — failures are logged and swallowed so email problems can't
 * break the main request, matching the SMS client's behaviour.
 */

import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { resolve4 } from 'dns/promises'

const GMAIL_USER = process.env.GMAIL_USER         ?? ''
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''
const FROM_NAME  = process.env.EMAIL_FROM_NAME    ?? 'FYP-WMS'

const SMTP_HOST = 'smtp.gmail.com'

/**
 * Build a transport pinned to an IPv4 address. Some hosts (e.g. Render) expose
 * an IPv6 interface without a working outbound IPv6 route, and nodemailer then
 * picks an unreachable AAAA address for smtp.gmail.com (ENETUNREACH). TLS still
 * validates against the real hostname via `servername`.
 */
async function createTransporter() {
  let host = SMTP_HOST
  try {
    const [addr] = await resolve4(SMTP_HOST)
    if (addr) host = addr
  } catch {
    // A-record lookup failed — let nodemailer resolve the hostname itself
  }
  return nodemailer.createTransport({
    host,
    port: 465,
    secure: true,
    servername: SMTP_HOST,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  } as SMTPTransport.Options)
}

/** Escape user-supplied values interpolated into email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Minimal branded HTML wrapper around a message body. */
function htmlTemplate(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
    <h2 style="color: #111827; margin: 0 0 16px;">${title}</h2>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="font-size: 12px; color: #6b7280; margin: 0;">
      This is an automated message from the Final Year Project Workflow Management System. Please do not reply.
    </p>
  </div>`
}

/** Send one email. Resolves even on failure (logs the error instead). */
export async function sendEmail(to: string, subject: string, title: string, bodyHtml: string): Promise<void> {
  if (!GMAIL_USER || !GMAIL_PASS) {
    console.warn('[Email] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping email')
    return
  }
  if (!to || !to.includes('@')) return

  try {
    const transporter = await createTransporter()
    await transporter.sendMail({
      from: `"${FROM_NAME}" <${GMAIL_USER}>`,
      to,
      subject,
      html: htmlTemplate(title, bodyHtml),
    })
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err)
  }
}

/** Send the same email to several recipients (individually, so addresses stay private). */
export async function sendEmailToMany(
  recipients: { email: string; name: string }[],
  subject: string,
  title: string,
  bodyHtmlFor: (name: string) => string
): Promise<void> {
  await Promise.all(
    recipients
      .filter((r) => r.email)
      .map((r) => sendEmail(r.email, subject, title, bodyHtmlFor(r.name)))
  )
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

/** Send a newly created user their login credentials. */
export function emailNewUser(email: string, name: string, tempPassword: string) {
  return sendEmail(
    email,
    'Your FYP-WMS account has been created',
    'Welcome to FYP-WMS',
    `<p>Hello ${esc(name)},</p>
     <p>An account has been created for you on the Final Year Project Workflow Management System.</p>
     <p><strong>Email:</strong> ${esc(email)}<br/>
        <strong>Temporary password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${esc(tempPassword)}</code></p>
     <p>Please log in and change your password immediately.</p>`
  )
}

/** Send a user their new admin-reset temporary password. */
export function emailPasswordReset(email: string, name: string, tempPassword: string) {
  return sendEmail(
    email,
    'Your FYP-WMS password has been reset',
    'Password Reset',
    `<p>Hello ${esc(name)},</p>
     <p>An administrator has reset your FYP-WMS password.</p>
     <p><strong>Temporary password:</strong> <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${esc(tempPassword)}</code></p>
     <p>Please log in and change your password immediately.</p>`
  )
}

/** Send a forgot-password OTP code. */
export function emailPasswordResetOtp(email: string, name: string, otp: string) {
  return sendEmail(
    email,
    'Your FYP-WMS password reset code',
    'Password Reset Code',
    `<p>Hello ${esc(name)},</p>
     <p>Your password reset code is:</p>
     <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #111827;">${esc(otp)}</p>
     <p>It expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`
  )
}

/** Notify group members of a proposal decision. */
export function emailProposalDecision(
  members: { email: string; name: string }[],
  proposalTitle: string,
  status: 'approved' | 'rejected',
  comment?: string
) {
  const approved = status === 'approved'
  return sendEmailToMany(
    members,
    `Proposal ${approved ? 'approved' : 'rejected'}: ${proposalTitle}`,
    `Proposal ${approved ? 'Approved' : 'Rejected'}`,
    (name) => approved
      ? `<p>Hello ${esc(name)},</p>
         <p>Your group's proposal "<strong>${esc(proposalTitle)}</strong>" has been <strong style="color:#059669;">approved</strong> by your supervisor.</p>`
      : `<p>Hello ${esc(name)},</p>
         <p>Your group's proposal "<strong>${esc(proposalTitle)}</strong>" was <strong style="color:#dc2626;">rejected</strong>.</p>
         <p><strong>Feedback:</strong> ${esc(comment ?? 'See system for details')}</p>
         <p>Please revise and resubmit.</p>`
  )
}

/** Send a deadline reminder to a list of students. */
export function emailDeadlineReminder(
  members: { email: string; name: string }[],
  deadlineType: string,
  dateLabel: string
) {
  return sendEmailToMany(
    members,
    `Reminder: FYP ${deadlineType} deadline on ${dateLabel}`,
    'Deadline Reminder',
    (name) =>
      `<p>Hello ${esc(name)},</p>
       <p>This is a reminder that your FYP <strong>${esc(deadlineType)}</strong> deadline is on <strong>${esc(dateLabel)}</strong>.</p>
       <p>Please ensure all required submissions are completed on time.</p>`
  )
}
