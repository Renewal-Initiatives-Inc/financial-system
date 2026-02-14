import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function createDb(): NeonHttpDatabase<typeof schema> | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.warn('DATABASE_URL is not set. Database operations will fail.')
    return null
  }
  const sql: NeonQueryFunction<boolean, boolean> = neon(connectionString)
  return drizzle(sql, { schema })
}

const _db = createDb()

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      throw new Error('Database not configured. Please set DATABASE_URL environment variable.')
    }
    return Reflect.get(_db, prop)
  },
})

export type Database = typeof db
