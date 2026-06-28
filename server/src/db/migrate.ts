/**
 * Simple migration runner.
 * Run with: npx ts-node src/db/migrate.ts
 *
 * Applies all .sql files in /migrations in filename order.
 * Tracks applied migrations in a `migrations` table.
 */

import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function migrate() {
  const client = await pool.connect()

  try {
    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id         SERIAL PRIMARY KEY,
        filename   VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

    for (const file of files) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM migrations WHERE filename = $1',
        [file]
      )

      if (rowCount && rowCount > 0) {
        console.log(`  skip  ${file}`)
        continue
      }

      console.log(`  apply ${file}`)
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`  done  ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      }
    }

    console.log('\nAll migrations applied.')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
