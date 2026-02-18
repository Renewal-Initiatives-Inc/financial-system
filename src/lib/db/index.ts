import { neon, Pool } from '@neondatabase/serverless'
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http'
import { drizzle as drizzlePool, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

// Primary driver: neon-http (stateless HTTP, reliable on Vercel serverless)
function getHttpDb() {
  if (!connectionString) return null
  const sql = neon(connectionString)
  return drizzleHttp(sql, { schema })
}

// Transaction driver: Pool (WebSocket, required for real SQL transactions)
let _pool: Pool | null = null
function getPoolDb() {
  if (!connectionString) return null
  if (!_pool) {
    _pool = new Pool({ connectionString })
  }
  return drizzlePool(_pool, { schema })
}

const _httpDb = getHttpDb()

// Proxy routes .transaction() to Pool driver, everything else to HTTP driver.
// This lets all 55+ call sites stay unchanged while fixing the cold-start
// failures caused by using Pool for all queries.
export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop) {
    if (!connectionString) {
      throw new Error('Database not configured. Please set DATABASE_URL environment variable.')
    }

    // Route transactions through Pool (WebSocket) — real SQL transactions
    if (prop === 'transaction') {
      const poolDb = getPoolDb()!
      return poolDb.transaction.bind(poolDb)
    }

    // Everything else through neon-http (stateless, fast, serverless-safe)
    return Reflect.get(_httpDb!, prop)
  },
})

export type Database = typeof db
