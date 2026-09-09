/**
 * Web Push delivery — sends a real browser push (shows even if the tab isn't
 * open/focused) alongside the in-app notification row that notify() writes.
 * Never throws — failures are logged and swallowed, matching email/SMS/Gemini.
 */
import webpush from 'web-push'
import { query } from '../db'

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? ''
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? ''
const SUBJECT      = process.env.VAPID_SUBJECT     ?? 'mailto:admin@example.com'

const configured = Boolean(PUBLIC_KEY && PRIVATE_KEY)
if (configured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY)
} else {
  console.warn('[WebPush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — push notifications disabled')
}

interface DbSubscription {
  id:       string
  endpoint: string
  p256dh:   string
  auth:     string
}

export interface PushPayload {
  title: string
  body?: string | null
  link?: string | null
}

/** Push the same payload to every browser/device a user has subscribed on. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return

  const subs = await query<DbSubscription>(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId]
  )
  if (subs.length === 0) return

  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
      } catch (err: any) {
        // 404/410 = the browser dropped this subscription (uninstalled, permission
        // revoked, expired) — clean it up so we stop trying.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]).catch(() => {})
        } else {
          console.error('[WebPush] Failed to send:', err?.statusCode ?? err)
        }
      }
    })
  )
}
