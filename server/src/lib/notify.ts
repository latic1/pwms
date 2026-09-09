import { query } from '../db'
import { sendPushToUser } from './webPush'

/**
 * Create an in-app notification for one user (shown in the bell menu) and,
 * if they've enabled it, push it to their browser too — even if the tab
 * isn't open. Fire-and-forget — errors are logged but not re-thrown,
 * matching audit().
 */
export async function notify(
  userId: string,
  type: string,
  title: string,
  body?: string | null,
  link?: string | null
): Promise<void> {
  try {
    await query(
      `INSERT INTO notifications (user_id, type, title, body, link)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title, body ?? null, link ?? null]
    )
  } catch (err) {
    console.error('[notify] Failed to write notification:', err)
  }

  sendPushToUser(userId, { title, body, link })
}

/** Same notification fanned out to several users (e.g. every member of a group). */
export async function notifyMany(
  userIds: string[],
  type: string,
  title: string,
  body?: string | null,
  link?: string | null
): Promise<void> {
  await Promise.all(userIds.map((id) => notify(id, type, title, body, link)))
}

/** IDs of every admin — used for system-wide notifications (new proposal, AI matching, digests). */
export async function getAdminIds(): Promise<string[]> {
  const rows = await query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE")
  return rows.map((r) => r.id)
}
