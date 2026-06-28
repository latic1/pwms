import crypto from 'crypto'
import { queryOne } from '../db'

/**
 * Generates a unique invite code in the format XXXXX-XXXX (uppercase alphanum).
 * Retries until a non-colliding code is found (collision is extremely unlikely).
 */
export async function generateInviteCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no O/0, I/1 to avoid confusion

  for (let attempt = 0; attempt < 10; attempt++) {
    const part1 = Array.from({ length: 5 }, () =>
      chars[crypto.randomInt(chars.length)]
    ).join('')
    const part2 = Array.from({ length: 4 }, () =>
      chars[crypto.randomInt(chars.length)]
    ).join('')
    const code = `${part1}-${part2}`

    const existing = await queryOne('SELECT id FROM groups WHERE invite_code = $1', [code])
    if (!existing) return code
  }

  throw new Error('Failed to generate a unique invite code after 10 attempts')
}
