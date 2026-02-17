import { Pool } from '@neondatabase/serverless'
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless'
import * as schema from './schema'

function createDb(): NeonDatabase<typeof schema> | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.warn('DATABASE_URL is not set. Database operations will fail.')
    return null
  }
  const pool = new Pool({ connectionString })
  return drizzle(pool, { schema })
}

const _db = createDb()

export const db = new Proxy({} as NeonDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      throw new Error('Database not configured. Please set DATABASE_URL environment variable.')
    }
    return Reflect.get(_db, prop)
  },
})

export type Database = typeof db
