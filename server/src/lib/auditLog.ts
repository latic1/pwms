import { query } from '../db'

/**
 * Append an entry to the audit_logs table.
 * Fire-and-forget — errors are logged but not re-thrown.
 */
export async function audit(
  actorId: string | null,
  action: string,
  targetType: string,
  targetId?: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorId, action, targetType, targetId ?? null, JSON.stringify(metadata)]
    )
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err)
  }
}
