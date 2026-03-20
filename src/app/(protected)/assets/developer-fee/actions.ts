'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { annualRateConfig } from '@/lib/db/schema'
import { auth } from '@/lib/auth'

const CONFIG_KEY = 'total_developer_fee'
const DEFAULT_VALUE = 827000

async function getAuthUser(): Promise<string> {
  const session = await auth()
  return session?.user?.name ?? 'system'
}

export async function getTotalDeveloperFee(): Promise<number> {
  const row = await db.query.annualRateConfig.findFirst({
    where: (c, { eq }) => eq(c.configKey, CONFIG_KEY),
    orderBy: (c, { desc }) => [desc(c.updatedAt)],
  })
  return row ? Number(row.value) : DEFAULT_VALUE
}

export async function updateTotalDeveloperFee(amount: number): Promise<void> {
  if (amount <= 0) throw new Error('Total developer fee must be positive')

  const userName = await getAuthUser()
  const currentYear = new Date().getFullYear()

  // Upsert: find existing row for this key, update or insert
  const existing = await db.query.annualRateConfig.findFirst({
    where: (c, { eq }) => eq(c.configKey, CONFIG_KEY),
  })

  if (existing) {
    await db
      .update(annualRateConfig)
      .set({
        value: String(amount),
        updatedBy: userName,
        updatedAt: new Date(),
      })
      .where(eq(annualRateConfig.id, existing.id))
  } else {
    await db.insert(annualRateConfig).values({
      fiscalYear: currentYear,
      configKey: CONFIG_KEY,
      value: String(amount),
      updatedBy: userName,
      updatedAt: new Date(),
    })
  }

  revalidatePath('/assets/developer-fee')
}
