'use server'

import { db } from '@/lib/db'
import { funds } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getFundsForFilter() {
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
      isActive: funds.isActive,
    })
    .from(funds)
    .where(eq(funds.isActive, true))
    .orderBy(funds.name)
}
