import { Router, Request, Response } from 'express'
import { query } from '../db'
import { authenticate } from '../middleware/authenticate'
import { validate } from '../middleware/validate'
import { pushSubscribeSchema, pushUnsubscribeSchema } from '../lib/schemas'

const router = Router()
router.use(authenticate)

// ─── POST /push/subscribe — register this browser for push notifications ─────

router.post('/subscribe', validate(pushSubscribeSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub
  const { endpoint, keys } = req.body

  // One row per endpoint (= per browser installation). Re-subscribing on the
  // same browser under a different account reassigns it rather than erroring.
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, endpoint, keys.p256dh, keys.auth]
  )

  res.status(204).send()
})

// ─── POST /push/unsubscribe — stop pushing to this browser ────────────────────

router.post('/unsubscribe', validate(pushUnsubscribeSchema), async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub
  const { endpoint } = req.body

  await query('DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2', [endpoint, userId])
  res.status(204).send()
})

export default router
